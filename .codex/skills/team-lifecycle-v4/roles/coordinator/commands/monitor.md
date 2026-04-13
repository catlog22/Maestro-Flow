# Monitor Pipeline

Synchronous pipeline coordination using spawn_agent + wait_agent.

## Constants

- WORKER_AGENT: team_worker
- SUPERVISOR_AGENT: team_supervisor (resident, woken via followup_task)

## Handler Router

| Source | Handler |
|--------|---------|
| "capability_gap" | handleAdapt |
| "check" or "status" | handleCheck |
| "resume" or "continue" | handleResume |
| All tasks completed | handleComplete |
| Default | handleSpawnNext |

## handleCheck

Read-only status report from tasks.json + team_msg progress, then STOP.

1. Read tasks.json
2. Count tasks by status (pending, in_progress, completed, failed, skipped)
3. Read worker progress from message bus:
   ```javascript
   const progressMsgs = mcp__maestro-tools__team_msg({
     operation: "list",
     session_id: sessionId,
     type: "progress",
     last: 50
   })
   const blockerMsgs = mcp__maestro-tools__team_msg({
     operation: "list",
     session_id: sessionId,
     type: "blocker",
     last: 10
   })
   // Aggregate latest milestone per task
   const taskProgress = {}
   for (const msg of progressMsgs.result.messages) {
     const tid = msg.data?.task_id
     if (tid && (!taskProgress[tid] || msg.ts > taskProgress[tid].ts)) {
       taskProgress[tid] = { phase: msg.data.phase, pct: msg.data.progress_pct, ts: msg.ts, summary: msg.summary }
     }
   }
   ```

4. Output enhanced status:

```
[coordinator] Pipeline Status
[coordinator] Progress: <done>/<total> (<pct>%)
[coordinator]
[coordinator] Active Workers:
[coordinator]   <task_id>  <role>  <milestone_phase>  <pct>%  "<summary>"  <time_ago>
[coordinator]   ...
[coordinator]
[coordinator] Blockers: <count> (or "none")
[coordinator]   <task_id>: <blocker_detail>    ← only if blockers exist
[coordinator]
[coordinator] Completed: <list>
[coordinator] Ready: <pending with resolved deps>
[coordinator] Commands: 'resume' to advance | 'check' to refresh
```

**CLI equivalent for human monitoring** (no coordinator needed):
```bash
maestro msg list -s "<session_id>" --type progress --last 10
maestro msg list -s "<session_id>" --type blocker
```

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
3. Has active agents -> check each:
   - If supervisor with `resident: true` + no CHECKPOINT in_progress + pending CHECKPOINT exists
     -> supervisor may have crashed. Respawn via spawn_agent({ agent_type: "team_supervisor" }) with recovery: true
4. Proceed to handleSpawnNext

## handleSpawnNext

Find ready tasks, spawn workers, wait for completion, process results.

1. Read tasks.json
2. Collect: completedTasks, inProgressTasks, readyTasks (pending + all deps completed)
3. No ready + nothing in progress -> handleComplete
4. No ready + work in progress -> report waiting, STOP
5. Has ready -> separate regular tasks and CHECKPOINT tasks

### Spawn Regular Tasks

For each ready non-CHECKPOINT task:

```javascript
// 1) Update status in tasks.json
state.tasks[task.id].status = 'in_progress'

// 2) Spawn worker
const agentId = spawn_agent({
  agent_type: "team_worker",
  task_name: task.id,  // e.g., "PLAN-001" — enables named targeting
  message: `## Role Assignment
role: ${task.role}
role_spec: ${skillRoot}/roles/${task.role}/role.md
session: ${sessionFolder}
session_id: ${sessionId}
requirement: ${requirement}
inner_loop: ${hasInnerLoop(task.role)}

Read role_spec file (${skillRoot}/roles/${task.role}/role.md) to load Phase 2-4 domain instructions.
Execute built-in Phase 1 (task discovery) -> role Phase 2-4 -> built-in Phase 5 (report).

## Task Context
task_id: ${task.id}
title: ${task.title}
description: ${task.description}
pipeline_phase: ${task.pipeline_phase}

## Upstream Context
${prevContext}

## Progress Milestones
session_id: ${sessionId}
Report progress via team_msg at natural phase boundaries (context loaded → core work done → verification).
Report blockers immediately via team_msg type="blocker".
Report completion via team_msg type="task_complete" after report_agent_job_result.
See agent-instruction.md "Progress Milestone Protocol" for format.`
})

// 3) Track agent
state.active_agents[task.id] = { agentId, role: task.role, started_at: now }
```

After spawning all ready regular tasks:

```javascript
// 4) Batch wait — use task_name for stable targeting (v4)
const taskNames = Object.entries(state.active_agents)
  .filter(([_, a]) => !a.resident)
  .map(([taskId]) => taskId)
const waitResult = wait_agent({ timeout_ms: 900000 })
// 4a) Drain progress from message bus (before collecting discoveries)
const progressMsgs = mcp__maestro-tools__team_msg({
  operation: "list", session_id: sessionId, type: "progress", last: 100
})
const blockerMsgs = mcp__maestro-tools__team_msg({
  operation: "list", session_id: sessionId, type: "blocker", last: 20
})
// Log execution trace
for (const msg of (progressMsgs.result?.messages || [])) {
  console.log(`[coordinator] trace: ${msg.summary}`)
}
if (blockerMsgs.result?.messages?.length > 0) {
  console.log(`[coordinator] WARNING: ${blockerMsgs.result.messages.length} blocker(s) reported during execution`)
  for (const b of blockerMsgs.result.messages) {
    console.log(`[coordinator]   ${b.data?.task_id}: ${b.data?.blocker_detail}`)
  }
}

if (waitResult.timed_out) {
  // Use progress trace to understand where workers got stuck
  for (const taskId of taskNames) {
    const lastProgress = (progressMsgs.result?.messages || [])
      .filter(m => m.data?.task_id === taskId)
      .pop()
    state.tasks[taskId].status = 'timed_out'
    state.tasks[taskId].error = lastProgress
      ? `Timed out at ${lastProgress.data.phase} (${lastProgress.data.progress_pct}%)`
      : 'Timed out with no progress reported'
    close_agent({ target: taskId })
    delete state.active_agents[taskId]
  }
} else {
  // 5) Collect results from discoveries/{task_id}.json
  for (const [taskId, agent] of Object.entries(state.active_agents)) {
    if (agent.resident) continue
    try {
      const disc = JSON.parse(Read(`${sessionFolder}/discoveries/${taskId}.json`))
      state.tasks[taskId].status = disc.status || 'completed'
      state.tasks[taskId].findings = disc.findings || ''
      state.tasks[taskId].quality_score = disc.quality_score || null
      state.tasks[taskId].error = disc.error || null
    } catch {
      state.tasks[taskId].status = 'failed'
      state.tasks[taskId].error = 'No discovery file produced'
    }
    close_agent({ target: taskId })  // Use task_name, not agentId
    delete state.active_agents[taskId]
  }
}
```

**Cross-Agent Supplementary Context** (v4):

When spawning workers in a later pipeline phase, send upstream results as supplementary context to already-running workers:

```
// Example: Send planning results to running implementers
send_message({
  target: "<running-agent-task-name>",
  message: `## Supplementary Context\n${upstreamFindings}`
})
// Note: send_message queues info without interrupting the agent's current work
```

Use `send_message` (not `followup_task`) for supplementary info that enriches but doesn't redirect the agent's current task.

### Handle CHECKPOINT Tasks

For each ready CHECKPOINT task:

1. Verify supervisor is in active_agents with `resident: true`
   - Not found -> spawn supervisor via SKILL.md Supervisor Spawn Template, record supervisorId
2. Determine scope: list task IDs that this checkpoint depends on (its deps)
3. Wake supervisor:
   ```javascript
   followup_task({
     target: supervisorId,
     message: `## Checkpoint Request
   task_id: ${task.id}
   scope: [${task.deps.join(', ')}]
   pipeline_progress: ${completedCount}/${totalCount} tasks completed`
   })
   const cpResult = wait_agent({ timeout_ms: 600000 })
   if (cpResult.timed_out) { /* mark checkpoint timed_out, close supervisor, STOP */ }
   ```
4. Read checkpoint report from artifacts/${task.id}-report.md
5. Parse verdict (pass / warn / block):
   - **pass** -> mark completed, proceed
   - **warn** -> log risks to wisdom, mark completed, proceed
   - **block** -> request_user_input: Override / Revise upstream / Abort

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

1. Shutdown resident supervisor (if active):
   ```javascript
   close_agent({ target: supervisorId })
   ```
   Remove from active_agents in tasks.json
2. Generate summary (deliverables, stats, discussions)
3. Read tasks.json completion_action:
   - interactive -> request_user_input (Archive/Keep/Export)
   - auto_archive -> Archive & Clean (rm -rf session folder)
   - auto_keep -> Keep Active (update status to "paused")

## handleAdapt

Capability gap reported mid-pipeline.

1. Parse gap description
2. Check if existing role covers it -> redirect
3. Role count < 5 -> generate dynamic role-spec in <session>/role-specs/
4. Add new task to tasks.json, spawn worker via spawn_agent + wait_agent
5. Role count >= 5 -> merge or pause
