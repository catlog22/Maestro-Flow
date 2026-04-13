# Monitor Pipeline

Synchronous pipeline coordination using spawn_agent + wait_agent.

## Constants

- WORKER_AGENT: team_worker
- ONE_STEP_PER_INVOCATION: false (synchronous wait loop)
- FAST_ADVANCE_AWARE: true
- MAX_GC_ROUNDS: 3

## Handler Router

| Source | Handler |
|--------|---------|
| "capability_gap" | handleAdapt |
| "check" or "status" | handleCheck |
| "resume" or "continue" | handleResume |
| All tasks completed | handleComplete |
| Default | handleSpawnNext |

## Role-Worker Map

| Prefix | Role | Role Spec | inner_loop |
|--------|------|-----------|------------|
| STRATEGY-* | strategist | `<project>/.codex/skills/team-testing/roles/strategist/role.md` | false |
| TESTGEN-* | generator | `<project>/.codex/skills/team-testing/roles/generator/role.md` | true |
| TESTRUN-* | executor | `<project>/.codex/skills/team-testing/roles/executor/role.md` | true |
| TESTANA-* | analyst | `<project>/.codex/skills/team-testing/roles/analyst/role.md` | false |

## handleCheck

Read-only status report from tasks.json, then STOP.

1. Read tasks.json
2. Count tasks by status (pending, in_progress, completed, failed)

```javascript
// Read progress and blocker messages from message bus
const progressMsgs = mcp__maestro-tools__team_msg({
  operation: "list", session_id: sessionId, type: "progress", last: 50
})
const blockerMsgs = mcp__maestro-tools__team_msg({
  operation: "list", session_id: sessionId, type: "blocker", last: 10
})
```

Output:
```
[coordinator] Testing Pipeline Status
[coordinator] Mode: <pipeline_mode>
[coordinator] Progress: <done>/<total> (<pct>%)
[coordinator] GC Rounds: L1: <n>/3, L2: <n>/3

[coordinator] Pipeline Graph:
  STRATEGY-001: <done|run|wait> test-strategy.md
  TESTGEN-001:  <done|run|wait> generating L1...
  TESTRUN-001:  <done|run|wait> blocked by TESTGEN-001
  TESTGEN-002:  <done|run|wait> blocked by TESTRUN-001
  TESTRUN-002:  <done|run|wait> blocked by TESTGEN-002
  TESTANA-001:  <done|run|wait> blocked by TESTRUN-*

[coordinator] Active Workers:
  <task_id>  <role>  <milestone_phase>  <pct>%  "<summary>"  <time_ago>

[coordinator] Blockers:
  <task_id>  <role>  "<blocker_summary>"  <time_ago>
  (omit section if no blockers)

[coordinator] Ready: <pending tasks with resolved deps>
[coordinator] Commands: 'resume' to advance | 'check' to refresh

**CLI monitoring** (works while coordinator is blocked):
maestro msg list -s "<session_id>" --type progress --last 10
```

Then STOP.

## handleResume

**Agent Health Check** (v4):
```
// Verify actual running agents match session state
const runningAgents = list_agents({})
// For each active_agent in tasks.json:
//   - If agent NOT in runningAgents -> agent crashed
//   - Reset that task to pending, remove from active_agents
// This prevents stale agent references from blocking the pipeline
```

1. Read tasks.json, check active_agents
2. No active agents -> handleSpawnNext
3. Has active agents -> check each status
   - completed -> mark done
   - in_progress -> still running
4. Some completed -> handleSpawnNext
5. All running -> report status, STOP

## handleSpawnNext

Find ready tasks, spawn workers, wait for completion, process results.

1. Read tasks.json
2. Collect:
   - completedTasks: status = completed
   - inProgressTasks: status = in_progress
   - readyTasks: status = pending AND all deps in completedTasks

3. No ready + work in progress -> report waiting, STOP
4. No ready + nothing in progress -> handleComplete
5. Has ready -> for each ready task:
   a. Determine role from prefix (use Role-Worker Map)
   b. Check if inner loop role (generator/executor) with active worker -> skip (worker picks up next task)
   c. Update task status in tasks.json -> in_progress
   d. team_msg log -> task_unblocked

### Spawn Workers

For each ready task:

```javascript
// 1) Update status in tasks.json
state.tasks[taskId].status = 'in_progress'

// 2) Spawn worker
const agentId = spawn_agent({
  agent_type: "team_worker",
  task_name: taskId,  // e.g., "STRATEGY-001" — enables named targeting
  message: `## Role Assignment
role: ${task.role}
role_spec: ${skillRoot}/roles/${task.role}/role.md
session: ${sessionFolder}
session_id: ${sessionId}
team_name: testing
requirement: ${task.description}
inner_loop: ${task.role === 'generator' || task.role === 'executor'}

## Current Task
- Task ID: ${taskId}
- Task: ${task.title}

Read role_spec file (${skillRoot}/roles/${task.role}/role.md) to load Phase 2-4 domain instructions.
Execute built-in Phase 1 (task discovery) -> role Phase 2-4 -> built-in Phase 5 (report).

## Task Context
task_id: ${taskId}
title: ${task.title}
description: ${task.description}

## Upstream Context
${prevContext}

## Progress Milestones
session_id: ${sessionId}
Report progress via team_msg at natural phase boundaries.
Report blockers immediately via team_msg type="blocker".
Report completion via team_msg type="task_complete" after report_agent_job_result.`
})

// 3) Track agent
state.active_agents[taskId] = { agentId, role: task.role, started_at: now }
```

6. **Parallel spawn** (comprehensive pipeline):
   - TESTGEN-001 + TESTGEN-002 both unblocked -> spawn both in parallel (name: "generator-1", "generator-2")
   - TESTRUN-001 + TESTRUN-002 both unblocked -> spawn both in parallel (name: "executor-1", "executor-2")

### Wait and Process Results

After spawning all ready tasks:

```javascript
// 4) Batch wait — use task_name for stable targeting (v4)
const taskNames = Object.keys(state.active_agents)
const waitResult = wait_agent({ timeout_ms: 900000 })

// Drain progress from message bus
const progressMsgs = mcp__maestro-tools__team_msg({
  operation: "list", session_id: sessionId, type: "progress", last: 100
})
for (const msg of (progressMsgs.result?.messages || [])) {
  console.log(`[coordinator] trace: ${msg.summary}`)
}

if (waitResult.timed_out) {
  for (const taskId of taskNames) {
    const lastProgress = (progressMsgs.result?.messages || [])
      .filter(m => m.data?.task_id === taskId).pop()
    state.tasks[taskId].status = 'timed_out'
    state.tasks[taskId].error = lastProgress
      ? `Timed out at ${lastProgress.data.phase} (${lastProgress.data.progress_pct}%)`
      : 'Timed out with no progress reported'
    close_agent({ target: taskId })
    delete state.active_agents[taskId]
  }
} else {
  // 5) Collect results
  for (const [taskId, agent] of Object.entries(state.active_agents)) {
    state.tasks[taskId].status = 'completed'
    close_agent({ target: taskId })  // Use task_name, not agentId
    delete state.active_agents[taskId]
  }
}
```

### GC Checkpoint (TESTRUN-* completes)

After TESTRUN-* completion, read meta.json for executor.pass_rate and executor.coverage:
- (pass_rate >= 0.95 AND coverage >= target) OR gc_rounds[layer] >= MAX_GC_ROUNDS -> proceed
- (pass_rate < 0.95 OR coverage < target) AND gc_rounds[layer] < MAX_GC_ROUNDS -> create GC fix tasks, increment gc_rounds[layer]

**GC Fix Task Creation** (when coverage below target):

Add to tasks.json:
```json
{
  "TESTGEN-<layer>-fix-<round>": {
    "title": "Revise <layer> tests (GC #<round>)",
    "description": "PURPOSE: Revise tests to fix failures and improve coverage | Success: pass_rate >= 0.95 AND coverage >= target\nTASK:\n  - Read previous test results and failure details\n  - Revise tests to address failures\n  - Improve coverage for uncovered areas\nCONTEXT:\n  - Session: <session-folder>\n  - Layer: <layer>\n  - Previous results: <session>/results/run-<N>.json\nEXPECTED: Revised test files in <session>/tests/<layer>/\nCONSTRAINTS: Only modify test files\n---\nInnerLoop: true\nRoleSpec: <project>/.codex/skills/team-testing/roles/generator/role.md",
    "role": "generator",
    "prefix": "TESTGEN",
    "deps": [],
    "status": "pending",
    "findings": null,
    "error": null
  },
  "TESTRUN-<layer>-fix-<round>": {
    "title": "Re-execute <layer> (GC #<round>)",
    "description": "PURPOSE: Re-execute tests after revision | Success: pass_rate >= 0.95\nCONTEXT:\n  - Session: <session-folder>\n  - Layer: <layer>\n  - Input: tests/<layer>\nEXPECTED: <session>/results/run-<N>-gc.json\n---\nInnerLoop: true\nRoleSpec: <project>/.codex/skills/team-testing/roles/executor/role.md",
    "role": "executor",
    "prefix": "TESTRUN",
    "deps": ["TESTGEN-<layer>-fix-<round>"],
    "status": "pending",
    "findings": null,
    "error": null
  }
}
```
Update tasks.json gc_rounds[layer]++

**Cross-Agent Supplementary Context** (v4):

When spawning workers in a later pipeline phase, send upstream results as supplementary context to already-running workers:

```
// Example: Send strategy results to running generators
send_message({
  target: "<running-agent-task-name>",
  message: `## Supplementary Context\n${upstreamFindings}`
})
// Note: send_message queues info without interrupting the agent's current work
```

Use `send_message` (not `followup_task`) for supplementary info that enriches but doesn't redirect the agent's current task.

### Persist and Loop

After processing all results:
1. Write updated tasks.json
2. Check if more tasks are now ready (deps newly resolved)
3. If yes -> loop back to step 1 of handleSpawnNext
4. If no more ready and all done -> handleComplete
5. If no more ready but some still blocked -> report status, STOP

## handleComplete

**Cleanup Verification** (v4):
```
// Verify all agents are properly closed
const remaining = list_agents({})
// If any team agents still running -> close_agent each
// Ensures clean session shutdown
```

Pipeline done. Generate report and completion action.

1. Verify all tasks (including any GC fix tasks) have status "completed" or "failed"
2. If any tasks incomplete -> return to handleSpawnNext
3. If all complete:
   - Read final state from meta.json (analyst.quality_score, executor.coverage, gc_rounds)
   - Generate summary (deliverables, task count, GC rounds, coverage metrics)
4. Execute completion action per tasks.json completion_action:
   - interactive -> request_user_input (Archive/Keep/Deepen Coverage)
   - auto_archive -> Archive & Clean (rm -rf session folder)
   - auto_keep -> Keep Active (status=paused)

## handleAdapt

Capability gap reported mid-pipeline.

1. Parse gap description
2. Check if existing role covers it -> redirect
3. Role count < 5 -> generate dynamic role-spec in <session>/role-specs/
4. Add new task to tasks.json, spawn worker via spawn_agent + wait_agent
5. Role count >= 5 -> merge or pause

## Fast-Advance Reconciliation

On every coordinator wake:
1. Read team_msg entries with type="fast_advance"
2. Sync active_agents with spawned successors
3. No duplicate spawns

## Phase 4: State Persistence

After every handler execution:
1. Reconcile active_agents with actual tasks.json states
2. Remove entries for completed/failed tasks
3. Write updated tasks.json
4. STOP (wait for next invocation)

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Session file not found | Error, suggest re-initialization |
| Unknown role in callback | Log info, scan for other completions |
| GC loop exceeded (3 rounds) | Accept current coverage with warning, proceed |
| Pipeline stall | Check deps chains, report to user |
| Coverage tool unavailable | Degrade to pass rate judgment |
| Worker crash | Reset task to pending in tasks.json, respawn via spawn_agent |
