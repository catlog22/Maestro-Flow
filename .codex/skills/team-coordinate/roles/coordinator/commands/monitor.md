# Command: monitor

## Purpose

Event-driven pipeline coordination with Spawn-and-Stop pattern. Role names are read from `team-session.json#roles`. Workers are spawned as `team_worker` agents with role-spec paths. Includes `handleComplete` for pipeline completion action and `handleAdapt` for mid-pipeline capability gap handling.

## When to Use

| Trigger | Condition |
|---------|-----------|
| Worker result | Result from wait_agent contains [role-name] from session roles |
| User command | "check", "status", "resume", "continue" |
| Capability gap | Worker reports capability_gap |
| Pipeline spawn | After dispatch, initial spawn needed |
| Pipeline complete | All tasks done |

## Strategy

- **Delegation**: Inline execution with handler routing
- **Beat model**: ONE_STEP_PER_INVOCATION -- one handler then STOP
- **Workers**: Spawned as team_worker via spawn_agent

## Constants

| Constant | Value | Description |
|----------|-------|-------------|
| SPAWN_MODE | spawn_agent | All workers spawned via `spawn_agent` |
| ONE_STEP_PER_INVOCATION | true | Coordinator does one operation then STOPS |
| FAST_ADVANCE_AWARE | true | Workers may skip coordinator for simple linear successors |
| WORKER_AGENT | team_worker | All workers spawned as team_worker agents |

## Phase 2: Context Loading

| Input | Source | Required |
|-------|--------|----------|
| Session file | `<session-folder>/team-session.json` | Yes |
| Task list | Read tasks.json | Yes |
| Active workers | session.active_workers[] | Yes |
| Role registry | session.roles[] | Yes |

**Dynamic role resolution**: Known worker roles are loaded from `session.roles[].name`. Role-spec paths are in `session.roles[].role_spec`.

## Phase 3: Handler Routing

### Wake-up Source Detection

Parse `$ARGUMENTS` to determine handler:

| Priority | Condition | Handler |
|----------|-----------|---------|
| 1 | Message contains `[<role-name>]` from session roles | handleCallback |
| 2 | Contains "capability_gap" | handleAdapt |
| 3 | Contains "check" or "status" | handleCheck |
| 4 | Contains "resume", "continue", or "next" | handleResume |
| 5 | Pipeline detected as complete | handleComplete |
| 6 | None of the above (initial spawn after dispatch) | handleSpawnNext |

---

### Handler: handleCallback

Worker completed a task. Verify completion, update state, auto-advance.

```
Receive result from wait_agent for [<role>]
  +- Find matching active worker by role (from session.roles)
  +- Is this a progress update (not final)? (Inner Loop intermediate task completion)
  |   +- YES -> Update session state, do NOT remove from active_workers -> STOP
  +- Task status = completed?
  |   +- YES -> remove from active_workers -> update session
  |   |   +- Close agent: close_agent({ target: <agentId> })
  |   |   +- -> handleSpawnNext
  |   +- NO -> progress message, do not advance -> STOP
  +- No matching worker found
      +- Scan all active workers for completed tasks
      +- Found completed -> process each -> handleSpawnNext
      +- None completed -> STOP
```

**Fast-advance reconciliation**: A worker may have already spawned its successor via fast-advance. When processing any callback or resume:
1. Read recent `fast_advance` messages from team_msg (type="fast_advance")
2. For each fast_advance message: add the spawned successor to `active_workers` if not already present
3. Check if the expected next task is already `in_progress` (fast-advanced)
4. If yes -> skip spawning that task (already running)
5. If no -> normal handleSpawnNext

---

### Handler: handleCheck

Read-only status report with progress milestones. No pipeline advancement.

1. Read tasks.json for pipeline state
2. Read worker progress from message bus:
   ```javascript
   const progressMsgs = mcp__maestro-tools__team_msg({
     operation: "list", session_id: sessionId, type: "progress", last: 50
   })
   const blockerMsgs = mcp__maestro-tools__team_msg({
     operation: "list", session_id: sessionId, type: "blocker", last: 10
   })
   ```
3. Aggregate latest milestone per active worker

**Output format**:

```
[coordinator] Pipeline Status
[coordinator] Progress: <completed>/<total> (<percent>%)

[coordinator] Execution Graph:
  <visual representation of dependency graph with status icons>

  done=completed  >>>=running  o=pending  .=not created

[coordinator] Active Workers:
  > <subject> (<role>) - <milestone_phase> <pct>% - running <elapsed>
  ...

[coordinator] Blockers: <count or "none">
  <task_id>: <blocker_detail>    ← only if blockers exist

[coordinator] Ready to spawn: <subjects>
[coordinator] Commands: 'resume' to advance | 'check' to refresh
```

**CLI equivalent for human monitoring** (works while coordinator is blocked):
```bash
maestro agent-msg list -s "<session_id>" --type progress --last 10
maestro agent-msg list -s "<session_id>" --type blocker
```

Then STOP.

---

### Handler: handleResume

**Agent Health Check** (v4):
```
// Verify actual running agents match session state
const runningAgents = list_agents({})
// For each active_agent in tasks.json:
//   - If agent NOT in runningAgents -> agent crashed
//   - Reset that task to pending, remove from active_agents
// This prevents stale agent references from blocking the pipeline
```

Check active worker completion, process results, advance pipeline.

```
Load active_workers from session
  +- No active workers -> handleSpawnNext
  +- Has active workers -> check each:
      +- status = completed -> mark done, log
      +- status = in_progress -> still running, log
      +- other status -> worker failure -> reset to pending
      After processing:
        +- Some completed -> handleSpawnNext
        +- All still running -> report status -> STOP
        +- All failed -> handleSpawnNext (retry)
```

---

### Handler: handleSpawnNext

Find all ready tasks, spawn team_worker agents, update session, STOP.

```
Collect task states from tasks.json
  +- completedSubjects: status = completed
  +- inProgressSubjects: status = in_progress
  +- readySubjects: pending + all deps in completedSubjects

Ready tasks found?
  +- NONE + work in progress -> report waiting -> STOP
  +- NONE + nothing in progress -> PIPELINE_COMPLETE -> handleComplete
  +- HAS ready tasks -> for each:
      +- Is task role an Inner Loop role AND that role already has an active_worker?
      |   +- YES -> SKIP spawn (existing worker will pick it up via inner loop)
      |   +- NO -> normal spawn below
      +- Update tasks.json entry status -> "in_progress"
      +- team_msg log -> task_unblocked (session_id=<session-id>)
      +- Spawn team_worker (see spawn call below)
      +- Add to session.active_workers
      Update session file -> output summary -> STOP
```

**Cross-Agent Supplementary Context** (v4):

When spawning workers in a later pipeline phase, send upstream results as supplementary context to already-running workers:

```
// Example: Send upstream task results to running downstream workers
send_message({
  target: "<running-agent-task-name>",
  message: `## Supplementary Context\n${upstreamFindings}`
})
// Note: send_message queues info without interrupting the agent's current work
```

Use `send_message` (not `followup_task`) for supplementary info that enriches but doesn't redirect the agent's current task.

**Spawn worker call** (one per ready task):

```
const agentId = spawn_agent({
  agent_type: "team_worker",
  task_name: taskId,  // e.g., "EXPLORE-001" — enables named targeting
  message: `## Role Assignment
role: <role>
role_spec: <session-folder>/role-specs/<role>.md
session: <session-folder>
session_id: <session-id>
team_name: <team-name>
requirement: <task-description>
inner_loop: <true|false>

Read role_spec file to load Phase 2-4 domain instructions.

## Progress Milestones
session_id: ${sessionId}
Report progress via team_msg at natural phase boundaries.
Report blockers immediately via team_msg type="blocker".
Report completion via team_msg type="task_complete" after report_agent_job_result.`
})
// Collect results — use task_name for stable targeting (v4):
const result = wait_agent({ timeout_ms: 1800000 })  // 30 min

// Drain progress from message bus (before processing results)
const progressMsgs = mcp__maestro-tools__team_msg({
  operation: "list", session_id: sessionId, type: "progress", last: 100
})
for (const msg of (progressMsgs.result?.messages || [])) {
  console.log(`[coordinator] trace: ${msg.summary}`)
}

if (result.timed_out) {
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
    }
    // else: forced output received, process result
  }
  // else: status received, continue processing
} else {
  // Process result, update tasks.json
  close_agent({ target: taskId })  // Use task_name, not agentId
}
```

---

### Handler: handleComplete

**Cleanup Verification** (v4):
```
// Verify all agents are properly closed
const remaining = list_agents({})
// If any team agents still running -> close_agent each
// Ensures clean session shutdown
```

Pipeline complete. Execute completion action based on session configuration.

```
All tasks completed (no pending, no in_progress)
  +- Generate pipeline summary:
  |   - Deliverables list with paths
  |   - Pipeline stats (tasks completed, duration)
  |   - Discussion verdicts (if any)
  |
  +- Read session.completion_action:
      |
      +- "interactive":
      |   request_user_input({
      |     questions: [{
      |       question: "Team pipeline complete. What would you like to do?",
      |       header: "Completion",
      |       multiSelect: false,
      |       options: [
      |         { label: "Archive & Clean (Recommended)", description: "Archive session, clean up team" },
      |         { label: "Keep Active", description: "Keep session for follow-up work" },
      |         { label: "Export Results", description: "Export deliverables to target directory" }
      |       ]
      |     }]
      |   })
      |   +- "Archive & Clean":
      |   |   Update session status="completed"
      |   |   Clean up session
      |   |   Output final summary with artifact paths
      |   +- "Keep Active":
      |   |   Update session status="paused"
      |   |   Output: "Resume with: Skill(skill='team-coordinate', args='resume')"
      |   +- "Export Results":
      |       request_user_input for target directory
      |       Copy deliverables to target
      |       Execute Archive & Clean flow
      |
      +- "auto_archive":
      |   Execute Archive & Clean without prompt
      |
      +- "auto_keep":
          Execute Keep Active without prompt
```

**Fallback**: If completion action fails, default to Keep Active (session status="paused"), log warning.

---

### Handler: handleAdapt

Handle mid-pipeline capability gap discovery. A worker reports `capability_gap` when it encounters work outside its scope.

**CONSTRAINT**: Maximum 5 worker roles per session. handleAdapt MUST enforce this limit.

```
Parse capability_gap message:
  +- Extract: gap_description, requesting_role, suggested_capability
  +- Validate gap is genuine:
      +- Check existing roles in session.roles -> does any role cover this?
      |   +- YES -> redirect to that role -> STOP
      |   +- NO -> genuine gap, proceed to role-spec generation
  +- CHECK ROLE COUNT LIMIT (MAX 5 ROLES):
      +- Count current roles in session.roles
      +- If count >= 5:
          +- Attempt to merge new capability into existing role
          +- If merge NOT possible -> PAUSE, report to user
  +- Generate new role-spec:
      1. Read specs/role-spec-template.md
      2. Fill template with: frontmatter (role, prefix, inner_loop, message_types) + Phase 2-4 content
      3. Write to <session-folder>/role-specs/<new-role>.md
      4. Add to session.roles[]
  +- Create new task(s) (add to tasks.json)
  +- Update team-session.json
  +- Spawn new team_worker -> STOP
```

---

### Worker Failure Handling

When a worker has unexpected status (not completed, not in_progress):

1. Reset task -> pending in tasks.json
2. Log via team_msg (type: error)
3. Report to user: task reset, will retry on next resume

### Fast-Advance Failure Recovery

When coordinator detects a fast-advanced task has failed:

```
handleCallback / handleResume detects:
  +- Task is in_progress (was fast-advanced by predecessor)
  +- No active_worker entry for this task
  +- Resolution:
      1. Update tasks.json -> reset task to pending
      2. Remove stale active_worker entry (if any)
      3. Log via team_msg (type: error)
      4. -> handleSpawnNext (will re-spawn the task normally)
```

### Fast-Advance State Sync

On every coordinator wake (handleCallback, handleResume, handleCheck):
1. Read team_msg entries with `type="fast_advance"` since last coordinator wake
2. For each entry: sync `active_workers` with the spawned successor
3. This ensures coordinator's state reflects fast-advance decisions even before the successor's callback arrives

### Consensus-Blocked Handling

```
handleCallback receives message with consensus_blocked flag
  +- Route by severity:
      +- severity = HIGH
      |   +- Create REVISION task (same role, incremented suffix)
      |   +- Max 1 revision per task. If already revised -> PAUSE, escalate to user
      +- severity = MEDIUM
      |   +- Proceed with warning, log to wisdom/issues.md
      |   +- Normal handleSpawnNext
      +- severity = LOW
          +- Proceed normally, treat as consensus_reached with notes
```

## Phase 4: Validation

| Check | Criteria |
|-------|----------|
| Session state consistent | active_workers matches tasks.json in_progress tasks |
| No orphaned tasks | Every in_progress task has an active_worker entry |
| Dynamic roles valid | All task roles exist in session.roles |
| Completion detection | readySubjects=0 + inProgressSubjects=0 -> PIPELINE_COMPLETE |
| Fast-advance tracking | Detect tasks already in_progress via fast-advance, sync to active_workers |

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Session file not found | Error, suggest re-initialization |
| Worker callback from unknown role | Log info, scan for other completions |
| All workers still running on resume | Report status, suggest check later |
| Pipeline stall (no ready, no running) | Check for missing tasks, report to user |
| Fast-advance conflict | Coordinator reconciles, no duplicate spawns |
| Dynamic role-spec file not found | Error, coordinator must regenerate from task-analysis |
| capability_gap when role limit (5) reached | Attempt merge, else pause for user |
| Completion action fails | Default to Keep Active, log warning |
