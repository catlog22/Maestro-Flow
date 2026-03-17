# Execute Workflow

Wave-based parallel execution with atomic commits, breakpoint resume, and optional sync/reflection.

---

## Prerequisites

- Phase has a completed plan: `plan.json` + `.task/TASK-*.json` exist
- `index.json` present with `plan.waves` populated
- OR: executionContext handoff received from `/workflow:plan`

---

## Phase Resolution

```
Input: <phase> argument (number or slug) OR --dir <path>

IF --dir <path> is provided:
  1. Set PHASE_DIR = <path> (absolute or relative to project root)
  2. Validate directory exists and contains index.json
  3. Set SCRATCH_MODE = true (skip roadmap validation, phase transition)
  4. Set PHASE_NUM = null, PHASE_SLUG = directory basename

ELSE (standard phase resolution):
  1. If number: find .workflow/phases/{NN}-*/index.json
  2. If slug: find .workflow/phases/*-{slug}/index.json
  3. Validate plan exists (index.json.plan.task_count > 0)
  4. Set PHASE_DIR = resolved path
```

---

## Flag Processing

| Flag | Effect |
|------|--------|
| `--auto-commit` | Override config: commit after each task completion |
| `--method agent\|cli` | Override execution method (default: config.json.execution.method) |
| `--dir <path>` | Use arbitrary directory instead of phase resolution (skip roadmap validation) |

---

## E1: Load Plan

**Purpose:** Build or receive the execution queue.

### From executionContext handoff (preferred)

```
If executionContext is available in memory:
  planObject = executionContext.planObject
  explorations = executionContext.explorations
  clarifications = executionContext.clarifications
  executionMethod = executionContext.executionMethod
  Skip disk reload
```

### From disk (fallback / resume)

```
Read ${PHASE_DIR}/index.json
Read ${PHASE_DIR}/plan.json

executionMethod = --method flag || config.json.execution.method || "agent"
```

### Detect completed tasks (breakpoint resume)

```
completed_tasks = []
For each task_id in index.json.plan.task_ids:
  Read .task/${task_id}.json
  If status == "completed":
    completed_tasks.push(task_id)

If completed_tasks.length > 0:
  Log "Resuming: {completed_tasks.length}/{total} tasks already completed"
  Filter completed tasks out of wave execution queue
  Set current_wave = first wave with pending tasks
```

### Build wave execution queue

```
waves = plan.json.waves (or index.json.plan.waves)

execution_queue = []
For each wave in waves:
  pending_tasks = wave.tasks.filter(t => !completed_tasks.includes(t))
  If pending_tasks.length > 0:
    execution_queue.push({ wave: wave.wave, tasks: pending_tasks })
```

### Output
- In-memory: execution_queue, executionMethod, loaded task definitions

---

## E1.5: Load Project Specs

```
specs_content = maestro spec load --category execution
```

Pass specs_content to each executor agent in E2.

---

## E2: Wave Parallel Execution

**Purpose:** Execute tasks wave by wave, parallel within each wave.

### Execution Loop

```
For each wave in execution_queue (sequential):

  Log "=== Wave {wave.wave}: {wave.tasks.length} tasks ==="

  Update index.json:
    execution.current_wave = wave.wave
    execution.started_at = execution.started_at || now()

  For each task_id in wave.tasks (parallel):

    # --- Per-task execution ---

    1. Load task definition
       Read .task/${task_id}.json (lazy loading)

    2. Spawn workflow-executor agent (fresh 200k context)
       Input:
         - Task definition (.task/${task_id}.json)
         - Phase context (index.json goal, success_criteria)
         - Relevant summaries from prior waves (.summaries/ of deps)
         - Execution method override (if --method cli)
         - Project specs (specs_content from E1.5 — coding conventions, architecture constraints, quality rules)

       Agent responsibilities:
         a. Read task definition (read_first, files, action, convergence.criteria)
         b. Implement the task (create/modify files per task.files)
         c. Verify convergence.criteria pass
         d. If verification fails: auto-fix (max 3 attempts)
         e. If auto-fix fails: write checkpoint, mark task as "blocked"
         f. Atomic commit (if auto-commit enabled):
            git add <task files>
            git commit -m "{type}({slug}): {task.title}"
         g. Write .summaries/${task_id}-summary.md
         h. Update .task/${task_id}.json:
            status = "completed" | "blocked"

    3. Collect result
       result = { task_id, status, summary_path, commit_hash }

    # --- End per-task ---

  Wait for all tasks in wave to complete

  # Post-wave processing
  For each result in wave_results:
    Update index.json.execution:
      tasks_completed += (completed count)
      commits.push({ hash, task, message }) for each commit

  If any task blocked:
    Log "Wave {wave.wave}: {blocked_count} tasks blocked"
    AskUserQuestion:
      "Tasks blocked: {blocked_list}. Continue to next wave or stop?"
      Options: [Continue (skip blocked), Stop and review]
    If stop: break execution loop

  Log "=== Wave {wave.wave} complete ==="
```

### Deviation Rule

```
Per task, max 3 auto-fix attempts:
  Attempt 1: Re-read error, try alternative approach
  Attempt 2: Simplify implementation
  Attempt 3: Minimal viable implementation

If all 3 fail:
  Mark task as "blocked" with checkpoint data:
    .task/${task_id}.json.meta.checkpoint = {
      attempt: 3,
      last_error: "...",
      partial_files: [...]
    }
  Continue wave (other tasks unaffected)
```

---

## E3: Auto Sync

**Purpose:** Update codebase documentation after execution.

```
If config.json.codebase.auto_sync_after_execute == true:
  Trigger /workflow:sync logic:
    1. Detect changed files (git diff from execution start)
    2. Map changes to doc-index.json components/features
    3. Update affected entries
    4. Refresh tech-registry and feature-maps as needed
Else:
  Log "Auto-sync disabled. Run /workflow:sync manually if needed."
```

---

## E4: Reflection (Optional)

**Purpose:** Record strategy observations for future iterations.

```
If config.json.workflow.reflection == true:
  Review execution results:
    - Which tasks completed smoothly?
    - Which required auto-fix attempts?
    - Any blocked tasks?
    - Patterns observed?

  Append to ${PHASE_DIR}/reflection-log.md:
    ## Reflection - Wave Execution {timestamp}
    - Strategy adjustments: [...]
    - Patterns noted: [...]
    - Blocked tasks: [...]

  Update index.json.reflection:
    rounds += 1
    strategy_adjustments.push(new adjustments)
```

---

## Final State Update

```
all_completed = index.json.execution.tasks_completed == index.json.execution.tasks_total

If all_completed:
  index.json.status = "verifying"  (ready for /workflow:verify)
  index.json.execution.completed_at = now()
  Log "All tasks completed. Run /workflow:verify to validate results."
Else:
  index.json.status = "executing"  (partial, can resume)
  Log "{completed}/{total} tasks completed. Re-run /workflow:execute to resume."

index.json.updated_at = now()
```

---

## Error Handling

| Error | Action |
|-------|--------|
| Phase directory not found | Abort: "Phase {phase} not found." |
| No plan exists | Abort: "No plan found. Run /workflow:plan first." |
| Task file missing | Skip task, log error, continue wave |
| Agent spawn fails | Retry once, then mark task as "blocked" |
| Git commit fails | Log warning, continue (task still marked completed) |
| All tasks in wave blocked | Stop execution, report blocked wave |

---

## Breakpoint Resume

The execute workflow is fully resumable:

```
State tracking in index.json.execution:
  tasks_completed: N     # Count of finished tasks
  current_wave: W        # Last active wave
  commits: [...]         # All commits made

Re-running /workflow:execute <phase>:
  1. Reads index.json.execution.tasks_completed
  2. Checks each .task/TASK-*.json status
  3. Builds queue of remaining tasks
  4. Continues from next pending wave
  5. No duplicate execution of completed tasks
```
