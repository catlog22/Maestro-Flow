# Monitor Pipeline

Event-driven pipeline coordination. Beat model: coordinator wake -> process -> spawn -> STOP.

## Constants

- SPAWN_MODE: background
- ONE_STEP_PER_INVOCATION: true
- FAST_ADVANCE_AWARE: true
- WORKER_AGENT: team-worker
- MAX_GC_ROUNDS: 3

## Handler Router

| Source | Handler |
|--------|---------|
| Message contains [scout], [strategist], [generator], [executor], [analyst] | handleCallback |
| "capability_gap" | handleAdapt |
| "check" or "status" | handleCheck |
| "resume" or "continue" | handleResume |
| All tasks completed | handleComplete |
| Default | handleSpawnNext |

## handleCallback

Worker completed. Process and advance.

1. Parse message to identify role and task ID:

| Message Pattern | Role Detection |
|----------------|---------------|
| `[scout]` or task ID `SCOUT-*` | scout |
| `[strategist]` or task ID `QASTRAT-*` | strategist |
| `[generator]` or task ID `QAGEN-*` | generator |
| `[executor]` or task ID `QARUN-*` | executor |
| `[analyst]` or task ID `QAANA-*` | analyst |

2. Check if progress update (inner loop) or final completion
3. Progress -> update session state, STOP
4. Completion -> mark task done (read `<session>/tasks.json`, set status to "completed", write back), remove from active_workers
5. Check for checkpoints:
   - QARUN-* completes -> read meta.json for coverage:
     - coverage >= target OR gc_rounds >= MAX_GC_ROUNDS -> proceed to handleSpawnNext
     - coverage < target AND gc_rounds < MAX_GC_ROUNDS -> create GC fix tasks, increment gc_rounds

**GC Fix Task Creation** (when coverage below target) -- add new entries to `<session>/tasks.json`:
```json
{
  "id": "QAGEN-fix-<round>",
  "subject": "QAGEN-fix-<round>: Fix tests for <layer> (GC #<round>)",
  "description": "PURPOSE: Fix failing tests and improve coverage | Success: Coverage meets target\nTASK:\n  - Load execution results and failing test details\n  - Fix broken tests and add missing coverage\nCONTEXT:\n  - Session: <session-folder>\n  - Layer: <layer>\n  - Previous results: <session>/results/run-<layer>.json\nEXPECTED: Fixed test files | Improved coverage\nCONSTRAINTS: Only modify test files | No source changes\n---\nInnerLoop: false\nRoleSpec: ~  or <project>/.codex/skills/team-quality-assurance/roles/generator/role.md",
  "status": "pending",
  "owner": "generator",
  "blockedBy": []
}
```

```json
{
  "id": "QARUN-gc-<round>",
  "subject": "QARUN-gc-<round>: Re-execute <layer> (GC #<round>)",
  "description": "PURPOSE: Re-execute tests after fixes | Success: Coverage >= target\nTASK: Execute test suite, measure coverage, report results\nCONTEXT:\n  - Session: <session-folder>\n  - Layer: <layer>\nEXPECTED: <session>/results/run-<layer>-gc-<round>.json\nCONSTRAINTS: Read-only execution\n---\nInnerLoop: false\nRoleSpec: ~  or <project>/.codex/skills/team-quality-assurance/roles/executor/role.md",
  "status": "pending",
  "owner": "executor",
  "blockedBy": ["QAGEN-fix-<round>"]
}
```

6. -> handleSpawnNext

## handleCheck

Read-only status report, then STOP.

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
[coordinator] QA Pipeline Status
[coordinator] Mode: <pipeline_mode>
[coordinator] Progress: <done>/<total> (<pct>%)
[coordinator] GC Rounds: <gc_rounds>/3

[coordinator] Pipeline Graph:
  SCOUT-001:   <done|run|wait> <summary>
  QASTRAT-001: <done|run|wait> <summary>
  QAGEN-001:   <done|run|wait> <summary>
  QARUN-001:   <done|run|wait> <summary>
  QAANA-001:   <done|run|wait> <summary>

[coordinator] Active Workers:
  <task_id>  <role>  <milestone_phase>  <pct>%  "<summary>"  <time_ago>

[coordinator] Blockers:
  <task_id>  <role>  "<blocker_summary>"  <time_ago>
  (omit section if no blockers)

[coordinator] Ready: <pending tasks with resolved deps>
[coordinator] Commands: 'resume' to advance | 'check' to refresh

**CLI monitoring** (works while coordinator is blocked):
maestro agent-msg list -s "<session_id>" --type progress --last 10
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

1. No active workers -> handleSpawnNext
2. Has active -> check each status
   - completed -> mark done (update tasks.json)
   - in_progress -> still running
3. Some completed -> handleSpawnNext
4. All running -> report status, STOP

## handleSpawnNext

Find ready tasks, spawn workers, STOP.

1. Collect from `<session>/tasks.json`:
   - completedSubjects: status = completed
   - inProgressSubjects: status = in_progress
   - readySubjects: status = pending AND all blockedBy in completedSubjects

2. No ready + work in progress -> report waiting, STOP
3. No ready + nothing in progress -> handleComplete
4. Has ready -> for each:
   a. Determine role from task prefix:

| Prefix | Role | inner_loop |
|--------|------|------------|
| SCOUT-* | scout | false |
| QASTRAT-* | strategist | false |
| QAGEN-* | generator | false |
| QARUN-* | executor | true |
| QAANA-* | analyst | false |

   b. Check if inner loop role with active worker -> skip (worker picks up next task)
   c. Update task status to "in_progress" in tasks.json
   d. team_msg log -> task_unblocked
   e. Spawn team-worker:

```
spawn_agent({
  agent_type: "team_worker",
  task_name: taskId,  // e.g., "SCOUT-001" — enables named targeting
  message: `## Role Assignment
role: <role>
role_spec: ~  or <project>/.codex/skills/team-quality-assurance/roles/<role>/role.md
session: <session-folder>
session_id: <session-id>
team_name: quality-assurance
requirement: <task-description>
inner_loop: <true|false>

## Current Task
- Task ID: <task-id>
- Task: <subject>

Read role_spec file to load Phase 2-4 domain instructions.
Execute built-in Phase 1 (task discovery) -> role Phase 2-4 -> built-in Phase 5 (report).

## Progress Milestones
session_id: ${sessionId}
Report progress via team_msg at natural phase boundaries.
Report blockers immediately via team_msg type="blocker".
Report completion via team_msg type="task_complete" after report_agent_job_result.`
})
```

   f. Add to active_workers
5. Update session, output summary, STOP
6. Use `wait_agent({ timeout_ms: 1800000 })` to wait for callbacks (30 min). If `result.timed_out`, send STATUS_CHECK via followup_task (wait 3 min), then FINALIZE with interrupt (wait 3 min), then mark timed_out and close agents. Workers use `report_agent_job_result()` to send results back.

### Post-Wait Processing

After `wait_agent` returns:

```javascript
// Drain progress from message bus
const progressMsgs = mcp__maestro-tools__team_msg({
  operation: "list", session_id: sessionId, type: "progress", last: 100
})
for (const msg of (progressMsgs.result?.messages || [])) {
  console.log(`[coordinator] trace: ${msg.summary}`)
}

if (waitResult.timed_out) {
  for (const taskId of Object.keys(state.active_workers)) {
    // Status probe before closing
    followup_task({ target: taskId, message: "STATUS_CHECK: Report current progress, findings so far, and estimated remaining work." })
    const status = wait_agent({ timeout_ms: 180000 })  // 3 min
    if (status.timed_out) {
      followup_task({ target: taskId, message: "FINALIZE: Output all current findings immediately. Time limit reached.", interrupt: true })
      const forced = wait_agent({ timeout_ms: 180000 })  // 3 min
      if (forced.timed_out) {
        const lastProgress = (progressMsgs.result?.messages || [])
          .filter(m => m.data?.task_id === taskId).pop()
        state.tasks[taskId].status = 'timed_out'
        state.tasks[taskId].error = lastProgress
          ? `Timed out at ${lastProgress.data.phase} (${lastProgress.data.progress_pct}%)`
          : 'Timed out with no progress reported'
        close_agent({ target: taskId })
        delete state.active_workers[taskId]
      }
      // else: forced output received, process result
    }
    // else: status received, continue processing
  }
} else {
  // Collect results, mark completed, close agents
}
```

**Cross-Agent Supplementary Context** (v4):

When spawning workers in a later pipeline phase, send upstream results as supplementary context to already-running workers:

```
// Example: Send scout results to running strategist
send_message({
  target: "<running-agent-task-name>",
  message: `## Supplementary Context\n${upstreamFindings}`
})
// Note: send_message queues info without interrupting the agent's current work
```

Use `send_message` (not `followup_task`) for supplementary info that enriches but doesn't redirect the agent's current task.

## handleComplete

**Cleanup Verification** (v4):
```
// Verify all agents are properly closed
const remaining = list_agents({})
// If any team agents still running -> close_agent each
// Ensures clean session shutdown
```

Pipeline done. Generate report and completion action.

1. Verify all tasks (including GC fix/recheck tasks) have status "completed" or "deleted" in tasks.json
2. If any tasks incomplete -> return to handleSpawnNext
3. If all complete:
   - Read final state from meta.json (quality_score, coverage, gc_rounds)
   - Generate summary (deliverables, stats, discussions)
4. Read session.completion_action:
   - interactive -> request_user_input (Archive/Keep/Export)
   - auto_archive -> Archive & Clean (status=completed, remove/archive session folder)
   - auto_keep -> Keep Active (status=paused)

## handleAdapt

Capability gap reported mid-pipeline.

1. Parse gap description
2. Check if existing role covers it -> redirect
3. Role count < 6 -> generate dynamic role-spec in <session>/role-specs/
4. Add new task entry to tasks.json, spawn worker
5. Role count >= 6 -> merge or pause

## Fast-Advance Reconciliation

On every coordinator wake:
1. Read team_msg entries with type="fast_advance"
2. Sync active_workers with spawned successors
3. No duplicate spawns

## Phase 4: State Persistence

After every handler execution:
1. Reconcile active_workers with actual tasks.json states
2. Remove entries for completed/deleted tasks
3. Write updated meta.json
4. STOP (wait for next callback)

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Session file not found | Error, suggest re-initialization |
| Worker callback from unknown role | Log info, scan for other completions |
| Pipeline stall (no ready, no running, has pending) | Check blockedBy chains, report to user |
| GC loop exceeded | Accept current coverage with warning, proceed |
| Scout finds 0 issues | Skip to testing mode, proceed to QASTRAT |
