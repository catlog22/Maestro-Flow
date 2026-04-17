# Monitor Pipeline

Synchronous pipeline coordination using spawn_agent + wait_agent.

## Constants

- WORKER_AGENT: team_worker
- FAST_ADVANCE_AWARE: true

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
| SCAN-* | scanner | `<project>/.codex/skills/team-review/roles/scanner/role.md` | false |
| REV-* | reviewer | `<project>/.codex/skills/team-review/roles/reviewer/role.md` | false |
| FIX-* | fixer | `<project>/.codex/skills/team-review/roles/fixer/role.md` | true |

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
[coordinator] Review Pipeline Status
[coordinator] Mode: <pipeline_mode>
[coordinator] Progress: <completed>/<total> (<percent>%)

[coordinator] Pipeline Graph:
  SCAN-001: <done|run|wait|deleted> <summary>
  REV-001:  <done|run|wait|deleted> <summary>
  FIX-001:  <done|run|wait|deleted> <summary>

  done=completed  >>>=running  o=pending  x=deleted

[coordinator] Active Workers:
  <task_id>  <role>  <milestone_phase>  <pct>%  "<summary>"  <time_ago>

[coordinator] Blockers:
  <task_id>  <role>  "<blocker_summary>"  <time_ago>
  (omit section if no blockers)

[coordinator] Ready to spawn: <subjects>
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
   - completed -> mark done in tasks.json
   - in_progress -> still running
   - other -> worker failure -> reset to pending
4. Some completed -> handleSpawnNext
5. All running -> report status, STOP

## handleSpawnNext

Find ready tasks, spawn workers, wait for results, process.

1. Read tasks.json:
   - completedTasks: status = completed
   - inProgressTasks: status = in_progress
   - deletedTasks: status = deleted
   - readyTasks: status = pending AND all deps in completedTasks

2. No ready + work in progress -> report waiting, STOP
3. No ready + nothing in progress -> handleComplete
4. Has ready -> take first ready task:
   a. Determine role from prefix (use Role-Worker Map)
   b. Update task status to in_progress in tasks.json
   c. team_msg log -> task_unblocked
   d. Spawn team_worker:

```javascript
// 1) Update status in tasks.json
state.tasks[taskId].status = 'in_progress'

// 2) Spawn worker
const agentId = spawn_agent({
  agent_type: "team_worker",
  task_name: taskId,  // e.g., "SCAN-001" — enables named targeting
  message: `## Role Assignment
role: ${role}
role_spec: ${skillRoot}/roles/${role}/role.md
session: ${sessionFolder}
session_id: ${sessionId}
requirement: ${taskDescription}
inner_loop: ${innerLoop}

## Current Task
- Task ID: ${taskId}
- Task: ${taskSubject}

Read role_spec file to load Phase 2-4 domain instructions.
Execute built-in Phase 1 (task discovery) -> role Phase 2-4 -> built-in Phase 5 (report).

## Progress Milestones
session_id: ${sessionId}
Report progress via team_msg at natural phase boundaries.
Report blockers immediately via team_msg type="blocker".
Report completion via team_msg type="task_complete" after report_agent_job_result.`
})

// 3) Track agent
state.active_agents[taskId] = { agentId, role, started_at: now }

// 4) Wait for completion — use task_name for stable targeting (v4)
const waitResult = wait_agent({ timeout_ms: 1800000 })  // 30 min

// Drain progress from message bus
const progressMsgs = mcp__maestro-tools__team_msg({
  operation: "list", session_id: sessionId, type: "progress", last: 100
})
for (const msg of (progressMsgs.result?.messages || [])) {
  console.log(`[coordinator] trace: ${msg.summary}`)
}

if (waitResult.timed_out) {
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
      delete state.active_agents[taskId]
    }
    // else: forced output received, process result
  }
  // else: status received, continue processing
} else {
  // 5) Collect results
  state.tasks[taskId].status = 'completed'
  close_agent({ target: taskId })  // Use task_name, not agentId
  delete state.active_agents[taskId]
}
```

   e. Check for checkpoints after worker completes:
      - scanner completes -> read meta.json for findings_count:
        - findings_count === 0 -> mark remaining REV-*/FIX-* tasks as deleted -> handleComplete
        - findings_count > 0 -> proceed to handleSpawnNext
      - reviewer completes AND pipeline_mode === 'full':
        - autoYes flag set -> write fix-manifest.json, set fix_scope='all' -> handleSpawnNext
        - NO autoYes -> request_user_input:
          ```
          question: "<N> findings reviewed. Proceed with fix?"
          options:
            - "Fix all": set fix_scope='all'
            - "Fix critical/high only": set fix_scope='critical,high'
            - "Skip fix": mark FIX-* tasks as deleted -> handleComplete
          ```
          Write fix_scope to meta.json, write fix-manifest.json, -> handleSpawnNext
      - fixer completes -> handleSpawnNext (checks for completion naturally)

5. Update tasks.json, output summary, STOP

**Cross-Agent Supplementary Context** (v4):

When spawning workers in a later pipeline phase, send upstream results as supplementary context to already-running workers:

```
// Example: Send scan results to running reviewer
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

1. All tasks completed or deleted (no pending, no in_progress)
2. Read final session state from meta.json
3. Generate pipeline summary: mode, target, findings_count, stages_completed, fix results (if applicable), deliverable paths
4. Update session: pipeline_status='complete', completed_at=<timestamp>
5. Read session.completion_action:
   - interactive -> request_user_input (Archive/Keep/Export)
   - auto_archive -> Archive & Clean
   - auto_keep -> Keep Active (status=paused)

## handleAdapt

Capability gap reported mid-pipeline.

1. Parse gap description
2. Check if existing role covers it -> redirect
3. Role count < 4 -> generate dynamic role-spec in <session>/role-specs/
4. Create new task in tasks.json, spawn worker
5. Role count >= 4 -> merge or pause

## Fast-Advance Reconciliation

On every coordinator wake:
1. Read tasks.json for completed tasks
2. Sync active_agents with actual state
3. No duplicate spawns

## State Persistence

After every handler execution:
1. Reconcile active_agents with actual tasks.json states
2. Remove entries for completed/deleted tasks
3. Write updated tasks.json
4. STOP (wait for next event)

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Session file not found | Error, suggest re-initialization |
| 0 findings after scan | Delete remaining stages, complete pipeline |
| User declines fix | Delete FIX-* tasks, complete with review-only results |
| Pipeline stall | Check deps chains, report to user |
| Worker failure | Reset task to pending, respawn on next resume |
