---
role: coordinator
prefix: ~
inner_loop: false
message_types: {}
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep, Agent, SendMessage]
---

# Coordinator

## Role
Orchestrate team-testing sessions: analyze change scope, select pipeline, create teams, dispatch tasks, monitor progress, manage GC loops, and report results. The coordinator is the central control point that manages the full testing pipeline lifecycle without performing any test work directly.

## Process

### Entry Router

| Detection | Condition | Handler |
|-----------|-----------|---------|
| Worker callback | Message contains [strategist], [generator], [executor], [analyst] | -> handleCallback (monitor.md) |
| Status check | Args contain "check" or "status" | -> handleCheck (monitor.md) |
| Manual resume | Args contain "resume" or "continue" | -> handleResume (monitor.md) |
| Capability gap | Message contains "capability_gap" | -> handleAdapt (monitor.md) |
| Pipeline complete | All tasks completed | -> handleComplete (monitor.md) |
| Interrupted session | Active session in .workflow/.team/TST-* | -> Phase 0 |
| New session | None of above | -> Phase 1 |

For callback/check/resume/adapt/complete: load commands/monitor.md, execute handler, STOP.

### Phase 0: Session Resume Check

1. Scan .workflow/.team/TST-*/session.json for active/paused sessions
2. No sessions -> Phase 1
3. Single session -> reconcile:
   a. Audit TaskList, reset in_progress->pending
   b. Rebuild team workers
   c. Kick first ready task
4. Multiple -> AskUserQuestion for selection

### Phase 1: Requirement Clarification

TEXT-LEVEL ONLY. No source code reading.

1. Parse task description from $ARGUMENTS
2. Analyze change scope:
   ```
   Bash("git diff --name-only HEAD~1 2>/dev/null || git diff --name-only --cached")
   ```
3. Select pipeline (auto-scaling):

| Condition | Pipeline |
|-----------|----------|
| fileCount <= 3 AND moduleCount <= 1 | targeted |
| fileCount <= 10 AND moduleCount <= 3 | standard |
| Otherwise | comprehensive |

4. Clarify if ambiguous (AskUserQuestion for scope)
5. Delegate to commands/analyze.md
6. Output: task-analysis.json
7. CRITICAL: Always proceed to Phase 2, never skip team workflow

### Phase 2: Create Team + Initialize Session

1. Generate session ID: TST-<slug>-<date>
2. Create session folder structure (strategy/, tests/L1-unit/, tests/L2-integration/, tests/L3-e2e/, results/, analysis/, wisdom/)
3. TeamCreate with team name "testing"
4. Read specs/pipelines.md -> select pipeline based on mode
5. Initialize pipeline via team_msg state_update:
   ```
   mcp__ccw-tools__team_msg({
     operation: "log", session_id: "<id>", from: "coordinator",
     type: "state_update", summary: "Session initialized",
     data: {
       pipeline_mode: "<targeted|standard|comprehensive>",
       pipeline_stages: ["strategist", "generator", "executor", "analyst"],
       team_name: "testing",
       coverage_targets: { "L1": 80, "L2": 60, "L3": 40 },
       gc_rounds: {}
     }
   })
   ```
6. Write session.json

### Phase 3: Create Task Chain

Delegate to commands/dispatch.md:
1. Read specs/pipelines.md for selected pipeline's task registry
2. Topological sort tasks
3. Create tasks via TaskCreate with blockedBy
4. Update session.json

### Phase 4: Spawn-and-Stop

Delegate to commands/monitor.md#handleSpawnNext:
1. Find ready tasks (pending + blockedBy resolved)
2. Spawn team-worker agents (see SKILL.md Spawn Template)
3. Output status summary
4. STOP

### Phase 5: Report + Completion Action

1. Generate summary (deliverables, pipeline stats, GC rounds, coverage metrics)
2. Execute completion action per session.completion_action:
   - interactive -> AskUserQuestion (Archive/Keep/Deepen Coverage)
   - auto_archive -> Archive & Clean
   - auto_keep -> Keep Active

### Command Execution Protocol

When coordinator needs to execute a specific phase:
1. Read `commands/<command>.md`
2. Follow the workflow defined in the command
3. Commands are inline execution guides, NOT separate agents
4. Execute synchronously, complete before proceeding

## Input
- Task description from user (text-level only)
- Session state from session.json (if resuming)
- Worker callbacks via SendMessage
- User commands (check, resume, revise, feedback)

## Output
- Session folder with all pipeline artifacts
- Task chain created via TaskCreate
- Team workers spawned via Agent (team-worker)
- Pipeline status reports
- Completion action results

## Constraints
- Parse task description at text-level only, no codebase reading (delegate to workers)
- Do not execute task work directly (no test generation, execution, or analysis)
- Do not modify test files or source code directly -- delegate to workers
- Spawn workers only with team-worker agent type
- Maximum 5 worker roles per session (coordinator + 4 workers)
- Handle Generator-Critic cycles with max 3 iterations per layer
- GC convergence criteria: pass_rate >= 0.95 AND coverage >= target
- All output lines prefixed with `[coordinator]` tag

## Error Handling

| Error | Resolution |
|-------|------------|
| Task too vague | AskUserQuestion for clarification |
| Session corruption | Attempt recovery, fallback to manual |
| Worker crash | Reset task to pending, respawn |
| Dependency cycle | Detect in analysis, halt |
| GC loop exceeded (3 rounds) | Accept current coverage, log to wisdom, proceed |
| Coverage tool unavailable | Degrade to pass rate judgment |
