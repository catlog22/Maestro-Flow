# Command: monitor

## Purpose

Synchronous pipeline coordination using spawn_agent + wait_agent for team-executor v2. Role names are read from `tasks.json#roles`. Workers are spawned as `team_worker` agents with role-spec paths. **handleAdapt is LIMITED**: only warns, cannot generate new role-specs. Includes `handleComplete` for pipeline completion action.

## Constants

| Constant | Value | Description |
|----------|-------|-------------|
| WORKER_AGENT | team_worker | All workers spawned via spawn_agent |
| ONE_STEP_PER_INVOCATION | false | Synchronous wait loop |
| FAST_ADVANCE_AWARE | true | Workers may skip executor for simple linear successors |
| ROLE_GENERATION | disabled | handleAdapt cannot generate new role-specs |

## Phase 2: Context Loading

| Input | Source | Required |
|-------|--------|----------|
| Session file | `<session-folder>/tasks.json` | Yes |
| Active agents | tasks.json active_agents | Yes |
| Role registry | tasks.json roles[] | Yes |

**Dynamic role resolution**: Known worker roles are loaded from `tasks.json roles[].name`. Role-spec paths are in `tasks.json roles[].role_spec`.

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
Receive callback from [<role>]
  +- Find matching active agent by role (from tasks.json roles)
  +- Is this a progress update (not final)?
  |   +- YES -> Update tasks.json state, do NOT remove from active_agents -> STOP
  +- Task status = completed?
  |   +- YES -> close_agent, remove from active_agents -> update tasks.json
  |   |   +- -> handleSpawnNext
  |   +- NO -> progress message, do not advance -> STOP
  +- No matching agent found
      +- Scan all active agents for completed tasks
      +- Found completed -> process each -> handleSpawnNext
      +- None completed -> STOP
```

**Fast-advance note**: Check if expected next task is already `in_progress` (fast-advanced). If yes -> skip spawning, sync active_agents.

---

### Handler: handleCheck

Read-only status report. No pipeline advancement.

```javascript
// Read progress and blocker messages from message bus
const progressMsgs = mcp__maestro-tools__team_msg({
  operation: "list", session_id: sessionId, type: "progress", last: 50
})
const blockerMsgs = mcp__maestro-tools__team_msg({
  operation: "list", session_id: sessionId, type: "blocker", last: 10
})
```

```
[executor] Pipeline Status
[executor] Progress: <completed>/<total> (<percent>%)

[executor] Execution Graph:
  <visual representation with status icons>

  done=completed  >>>=running  o=pending  .=not created

[executor] Active Workers:
  <task_id>  <role>  <milestone_phase>  <pct>%  "<summary>"  <time_ago>

[executor] Blockers:
  <task_id>  <role>  "<blocker_summary>"  <time_ago>
  (omit section if no blockers)

[executor] Ready to spawn: <subjects>
[executor] Commands: 'resume' to advance | 'check' to refresh

**CLI monitoring** (works while executor is blocked):
maestro msg list -s "<session_id>" --type progress --last 10
```

Then STOP.

---

### Handler: handleResume

Check active agent completion, process results, advance pipeline.

```
Load active_agents from tasks.json
  +- No active agents -> handleSpawnNext
  +- Has active agents -> check each:
      +- status = completed -> mark done, close_agent, log
      +- status = in_progress -> still running, log
      +- other status -> worker failure -> reset to pending
      After processing:
        +- Some completed -> handleSpawnNext
        +- All still running -> report status -> STOP
        +- All failed -> handleSpawnNext (retry)
```

---

### Handler: handleSpawnNext

Find all ready tasks, spawn team_worker agents, wait for completion, process results.

```
Read tasks.json
  +- completedTasks: status = completed
  +- inProgressTasks: status = in_progress
  +- readyTasks: pending + all deps in completedTasks

Ready tasks found?
  +- NONE + work in progress -> report waiting -> STOP
  +- NONE + nothing in progress -> PIPELINE_COMPLETE -> handleComplete
  +- HAS ready tasks -> for each:
      +- Is task owner an Inner Loop role AND already has active_agents?
      |   +- YES -> SKIP spawn (existing worker picks it up)
      |   +- NO -> normal spawn below
      +- Update task status in tasks.json -> in_progress
      +- team_msg log -> task_unblocked (session_id=<session-id>)
      +- Spawn team_worker (see spawn tool call below)
      +- Add to tasks.json active_agents
```

**Spawn worker tool call**:

```javascript
const agentId = spawn_agent({
  agent_type: "team_worker",
  message: `## Role Assignment
role: ${task.role}
role_spec: ${sessionFolder}/role-specs/${task.role}.md
session: ${sessionFolder}
session_id: ${sessionId}
team_name: ${teamName}
requirement: ${task.description}
inner_loop: ${hasInnerLoop(task.role)}

Read role_spec file (${sessionFolder}/role-specs/${task.role}.md) to load Phase 2-4 domain instructions.

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

state.active_agents[taskId] = { agentId, role: task.role, started_at: now }
```

### Wait and Process Results

After spawning all ready tasks:

```javascript
// Batch wait for all spawned workers
const agentIds = Object.values(state.active_agents)
  .filter(a => !a.resident)
  .map(a => a.agentId)
const waitResult = wait_agent({ timeout_ms: 900000 })

// Drain progress from message bus
const progressMsgs = mcp__maestro-tools__team_msg({
  operation: "list", session_id: sessionId, type: "progress", last: 100
})
for (const msg of (progressMsgs.result?.messages || [])) {
  console.log(`[executor] trace: ${msg.summary}`)
}

if (waitResult.timed_out) {
  for (const [taskId, agent] of Object.entries(state.active_agents)) {
    if (agent.resident) continue
    const lastProgress = (progressMsgs.result?.messages || [])
      .filter(m => m.data?.task_id === taskId).pop()
    state.tasks[taskId].status = 'timed_out'
    state.tasks[taskId].error = lastProgress
      ? `Timed out at ${lastProgress.data.phase} (${lastProgress.data.progress_pct}%)`
      : 'Timed out with no progress reported'
    close_agent({ target: agent.agentId })
    delete state.active_agents[taskId]
  }
} else {
  // Collect results from discoveries/{task_id}.json
  for (const [taskId, agent] of Object.entries(state.active_agents)) {
    if (agent.resident) continue
    try {
      const disc = JSON.parse(Read(`${sessionFolder}/discoveries/${taskId}.json`))
      state.tasks[taskId].status = disc.status || 'completed'
      state.tasks[taskId].findings = disc.findings || ''
      state.tasks[taskId].error = disc.error || null
    } catch {
      state.tasks[taskId].status = 'failed'
      state.tasks[taskId].error = 'No discovery file produced'
    }
    close_agent({ target: agent.agentId })
    delete state.active_agents[taskId]
  }
}
```

### Persist and Loop

After processing all results:
1. Write updated tasks.json
2. Check if more tasks are now ready (deps newly resolved)
3. If yes -> loop back to step 1 of handleSpawnNext
4. If no more ready and all done -> handleComplete
5. If no more ready but some still blocked -> report status, STOP

---

### Handler: handleComplete

Pipeline complete. Execute completion action.

```
All tasks completed (no pending, no in_progress)
  +- Generate pipeline summary (deliverables, stats, duration)
  +- Read tasks.json completion_action:
      |
      +- "interactive":
      |   request_user_input -> user choice:
      |   +- "Archive & Clean": rm -rf session folder -> summary
      |   +- "Keep Active": session status="paused" -> resume command
      |   +- "Export Results": copy artifacts -> Archive & Clean
      |
      +- "auto_archive": Execute Archive & Clean
      +- "auto_keep": Execute Keep Active
```

**Fallback**: If completion action fails, default to Keep Active, log warning.

---

### Handler: handleAdapt (LIMITED)

**UNLIKE team-coordinate, executor CANNOT generate new role-specs.**

```
Receive capability_gap from [<role>]
  +- Log via team_msg (type: warning)
  +- Check existing roles -> does any cover this?
  |   +- YES -> redirect to that role -> STOP
  |   +- NO -> genuine gap, report to user:
  |       "Capability gap detected. team-executor cannot generate new role-specs.
  |        Options: 1. Continue  2. Re-run team-coordinate  3. Manually add role-spec"
  +- Continue execution with existing roles
```

---

### Worker Failure Handling

1. Reset task -> pending in tasks.json
2. Log via team_msg (type: error)
3. Report to user: task reset, will retry on next resume

### Fast-Advance Failure Recovery

Detect orphaned tasks (in_progress without active_agents, > 5 minutes) -> reset to pending -> handleSpawnNext.

### Consensus-Blocked Handling

```
Route by severity:
  +- HIGH: Create REVISION task (max 1). Already revised -> PAUSE for user (request_user_input)
  +- MEDIUM: Proceed with warning, log to wisdom/issues.md
  +- LOW: Proceed normally as consensus_reached with notes
```

## Phase 4: Validation

| Check | Criteria |
|-------|----------|
| Session state consistent | active_agents matches tasks.json in_progress tasks |
| No orphaned tasks | Every in_progress task has an active_agents entry |
| Dynamic roles valid | All task owners exist in tasks.json roles |
| Completion detection | readyTasks=0 + inProgressTasks=0 -> PIPELINE_COMPLETE |
| Fast-advance tracking | Detect fast-advanced tasks, sync to active_agents |

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Session file not found | Error, suggest re-run team-coordinate |
| Unknown role in callback | Log info, scan for other completions |
| All workers still running on resume | Report status, suggest check later |
| Pipeline stall | Check for missing tasks, report to user |
| Fast-advance conflict | Executor reconciles, no duplicate spawns |
| Role-spec file not found | Error, cannot proceed |
| capability_gap | WARN only, cannot generate new role-specs |
| Completion action fails | Default to Keep Active, log warning |
