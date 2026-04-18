# Workflow: status

Status dashboard with intelligent routing.

---

## Step 1: Load State

1. Check `.workflow/state.json` exists:
   - If missing → display "No project initialized. Run `/workflow:init` to start." → exit

2. Read `.workflow/state.json`:
   - Extract: project_name, current_milestone, current_phase, status, phases_summary
   - Extract: accumulated_context (key_decisions, blockers, deferred)

3. Read `.workflow/roadmap.md`:
   - Extract phase list with titles

4. Load Issue State:
   - If `.workflow/issues/issues.jsonl` exists:
     - Read all lines, parse each as JSON
     - Compute statistics:
       ```
       by_status: {
         registered: count(status == "registered"),
         diagnosed:  count(status == "diagnosed"),
         planning:   count(status == "planning"),
         planned:    count(status == "planned"),
         executing:  count(status == "executing")
       }
       by_severity: {
         critical: count(severity == "critical"),
         high:     count(severity == "high"),
         medium:   count(severity == "medium"),
         low:      count(severity == "low")
       }
       total_open:    count where status NOT in [completed, failed, deferred]
       critical_open: count where severity == "critical" AND status NOT in [completed, failed, deferred]
       critical_issues: list of {id, title, status} where severity == "critical" AND status NOT in [completed, failed, deferred]
       ```
     - Store as issue_state
   - Else:
     - issue_state = null (no issues tracked)

---

## Step 2: Load Phase Details

For each phase directory in `.workflow/phases/*/`:

1. Read `index.json` if exists:
   - Extract: phase number, slug, title, status, goal
   - Extract: plan (task_count, tasks_completed), execution progress
   - Extract: verification status, validation status, uat status

2. Build phase summary array:
   ```
   phases[] = {
     number, slug, title, status,
     tasks_total, tasks_completed,
     verification_status, validation_status
   }
   ```

---

## Step 2.5: Roadmap ↔ State Consistency Check

Verify that `roadmap.md` and `state.json` agree on phase structure:

```
IF .workflow/roadmap.md exists:
  roadmap_phases = parse phase headings from roadmap.md (count "### Phase N:" entries)
  state_total = state.json.phases_summary.total
  actual_dirs = count .workflow/phases/*/ directories

  IF roadmap_phases != state_total OR roadmap_phases != actual_dirs:
    Display WARNING:
      ⚠️  STATE SYNC WARNING
      Roadmap phases: {roadmap_phases}
      State total:    {state_total}
      Phase dirs:     {actual_dirs}
      Run /maestro-roadmap or /maestro-phase-add to reconcile.

ELSE IF NOT .workflow/roadmap.md exists AND state.json.phases_summary.total > 0:
  Display WARNING:
    ⚠️  Roadmap missing but state.json references {total} phases.
    This may indicate a completed milestone. Run /maestro continue to plan next milestone.
```

---

## Step 3: Compute Progress

1. Count by status:
   ```
   total     = phases.length
   completed = phases.filter(status == "completed").length
   executing = phases.filter(status == "executing").length
   planning  = phases.filter(status == "planning").length
   exploring = phases.filter(status == "exploring").length
   pending   = phases.filter(status == "pending").length
   blocked   = phases.filter(status == "blocked").length
   ```

2. Calculate overall progress:
   ```
   progress_pct = (completed / total) * 100
   ```

---

## Step 4: Display Dashboard

```
====================================================
  PROJECT: {project_name}
  MILESTONE: {current_milestone}
  STATUS: {status}
  PROGRESS: [{progress_bar}] {completed}/{total} phases ({progress_pct}%)
====================================================

PHASES:
  {for each phase}
  [{status_icon}] Phase {number}: {title}
      Status: {status}
      Tasks: {tasks_completed}/{tasks_total}
      Verification: {verification_status}
  {/for}

CONTEXT:
  Key Decisions: {key_decisions, comma-separated}
  Blockers: {blockers or "none"}
  Deferred: {deferred or "none"}

====================================================
```

### Step 4.1: Render Issue Summary

If issue_state is not null:

```
┌─────────────────────────────────────────┐
│ ISSUES                                  │
├─────────────────────────────────────────┤
│ Open: {total_open}                      │
│   Critical: {critical_open}             │
│   By Status:                            │
│     registered: {N} | diagnosed: {N}    │
│     planning: {N}   | planned: {N}      │
│     executing: {N}                      │
│                                         │
│ Critical Issues:                        │
│   {id} | {title (truncated 40ch)} | {status}  │
│   ...                                   │
└─────────────────────────────────────────┘
```

If critical_issues is empty, omit the "Critical Issues:" sub-section.

If accumulated_context.blockers is non-empty AND issue_state has critical issues:
  - Print: "Note: Blockers are now tracked as critical issues in .workflow/issues/issues.jsonl"

If accumulated_context.deferred is non-empty:
  - Print: "Note: Deferred items are tracked as deferred issues. Use /manage-issue list --status deferred"

Else (issue_state is null):
  - Print: "ISSUES: No issues tracked. Use /manage-issue create or /maestro-verify to discover issues."

Status icons:
- `[x]` completed
- `[>]` executing / in_progress
- `[~]` planning / exploring
- `[ ]` pending
- `[!]` blocked

### Step 4.2: Render Worktree Status

```
IF file_exists(".workflow/worktree-scope.json"):
  // Running inside a worktree
  Read .workflow/worktree-scope.json → scope
  Display:
    ┌─────────────────────────────────────────┐
    │ WORKTREE MODE                           │
    ├─────────────────────────────────────────┤
    │ Milestone: {scope.milestone}            │
    │ Branch:    {scope.branch}               │
    │ Phases:    {scope.owned_phases}         │
    │ Main:      {scope.main_worktree}        │
    └─────────────────────────────────────────┘

ELSE IF file_exists(".workflow/worktrees.json"):
  // Running in main worktree with active worktrees
  Read .workflow/worktrees.json → registry
  activeWorktrees = registry.worktrees.filter(w => w.status === "active")

  IF activeWorktrees.length > 0:
    Display:
      ┌─────────────────────────────────────────┐
      │ ACTIVE WORKTREES                        │
      ├─────────────────────────────────────────┤
      {for each wt in activeWorktrees}
      │ {wt.milestone} | {wt.branch} | {wt.path} │
      {/for}
      │                                         │
      │ Sync:  /maestro-fork <milestone> --sync │
      │ Merge: /maestro-merge <milestone>       │
      └─────────────────────────────────────────┘
```

---

## Step 5: Route Next Step

### Step 5.0: Issue-Aware Routing

If issue_state is not null, evaluate issue-based recommendations BEFORE status routing:

If critical_open > 0:
  - Recommend: "{critical_open} critical issues require attention"
  - Suggest: Skill({ skill: "manage-issue", args: "list --severity critical" })
  - Suggest: Skill({ skill: "quality-debug", args: "--from-uat" })

If by_status.diagnosed > 0:
  - Recommend: "{diagnosed} issues diagnosed and ready for planning"
  - Suggest: Skill({ skill: "maestro-plan", args: "--gaps" })

If by_status.registered > 0:
  - Recommend: "{registered} new issues need investigation"
  - Suggest: Skill({ skill: "quality-debug" })

### Step 5.1: Status-Based Routing

Based on current project status, suggest the next command:

```
STATUS ROUTING TABLE:
-------------------------------------------------------------
Current Status    | Suggested Command           | Reason
-------------------------------------------------------------
idle              | /workflow:init              | Project needs initialization
exploring         | /maestro-analyze -q        | Continue exploration, lock decisions
                  | /workflow:plan {phase}      | Ready to plan
planning          | /workflow:plan {phase}      | Resume planning
executing         | /workflow:execute {phase}   | Resume execution
verifying         | /workflow:verify {phase}    | Complete verification
                  | /workflow:review {phase}    | Code quality review
                  | /workflow:test {phase}      | Run tests
reviewing         | /workflow:review {phase}    | Complete review
testing           | /workflow:test {phase}      | Complete testing
completed (phase) | /workflow:phase-transition  | Move to next phase
completed (all)   | /workflow:milestone-audit   | Audit milestone
blocked           | /workflow:debug             | Resolve blockers
-------------------------------------------------------------
```

Display:
```
NEXT STEP: /workflow:{suggested_command}
  {reason}
```

If there are blockers, display them prominently before the routing suggestion.

---

## Step 6: Scratch Tasks (if any)

Check `.workflow/scratch/` for active tasks:

1. For each `scratch/*/index.json` where status != "completed":
   - Display: type, title, status, progress
2. If active scratch tasks exist:
   - Note: "Active scratch tasks found. These are independent of phase pipeline."
