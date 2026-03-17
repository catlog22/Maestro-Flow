# Workflow: phase-transition

Mark a phase as complete, validate readiness, extract learnings, update project state, and route to next action.

## Trigger

- Manual via `/workflow:phase-transition [phase-number] [--force]`
- Suggested by `/workflow:status` when a phase has all tasks completed and verification passed

## Arguments

| Arg | Description | Default |
|-----|-------------|---------|
| `[phase-number]` | Phase to transition | Current phase from state.json |
| `--force` | Skip validation checks and force completion | `false` |

## Prerequisites

- `.workflow/state.json` must exist
- `.workflow/phases/{NN}-{slug}/index.json` must exist for the target phase
- Phase should have tasks executed and verification attempted

---

## Workflow Steps

### Step 1: Load Phase Data

```
a. Read .workflow/state.json
   Extract: current_phase, phases_summary

b. Determine target phase:
   If phase-number argument provided: use it
   Else: use state.json.current_phase

c. Find phase directory:
   Glob: .workflow/phases/{NN}-*/
   Match where NN == target phase number
   If not found: fail "Phase {NN} directory not found"

d. Read .workflow/phases/{NN}-{slug}/index.json
   Extract: status, plan.task_ids, verification, validation, uat
```

### Step 2: Validate Completion

```
Check completion criteria (unless --force):

a. Task completion:
   For each task_id in plan.task_ids:
     Read .workflow/phases/{NN}-{slug}/.task/{task_id}.json
     Check status == "completed"

   incomplete_tasks = tasks where status != "completed"
   If incomplete_tasks.length > 0:
     BLOCKER: "Tasks not completed: {incomplete_tasks}"

b. Verification status:
   Check index.json verification.status
   If verification.status == "pending":
     BLOCKER: "Verification not attempted (run /workflow:verify first)"
   If verification.status == "gaps_found":
     WARNING: "Verification has unresolved gaps"
     (Not a hard blocker, but warn)

c. Validation status (if applicable):
   Check index.json validation.status
   If validation.status == "gaps_found":
     WARNING: "Test validation has gaps"

c2. Review status (if applicable):
   IF file exists "${PHASE_DIR}/review.json":
     Read review.json.verdict
     If verdict == "BLOCK":
       WARNING: "Code review verdict is BLOCK — critical findings should be fixed first (W003)"
   ELSE:
     WARNING: "Code review not yet run — recommended before transition (W004)"

d. If any BLOCKERs found and not --force:
   Display all blockers and warnings
   AskUserQuestion: "Phase has blockers. Force complete anyway? [y/N]"
   If no: exit with blocker list
   If yes: proceed (treat as --force)

e. If only WARNINGs:
   Display warnings
   AskUserQuestion: "Phase has warnings but no blockers. Complete? [Y/n]"
   If no: exit
```

### Step 2.1: Validate Open Issues

```
Read .workflow/issues/issues.jsonl (if exists)
Filter issues where phase_ref == completing_phase_slug
  AND status NOT in ["completed", "failed", "deferred"]

open_critical = filtered issues where severity == "critical"
open_other = filtered issues where severity != "critical"

If open_critical.length > 0:
  BLOCKER: "Cannot transition: {open_critical.length} critical issues unresolved"
  For each issue in open_critical:
    Display: "  {issue.id} | {issue.title} | {issue.status}"

If open_other.length > 0:
  WARNING: "{open_other.length} non-critical issues still open -- will be auto-closed on transition"
  For each issue in open_other:
    Display: "  {issue.id} | {issue.title} | {issue.severity} | {issue.status}"

Apply same BLOCKER/WARNING logic as Step 2d-2e above.
```

### Step 3: Update Phase Index

```
Update .workflow/phases/{NN}-{slug}/index.json:

  status: "completed"
  completed_at: "{ISO timestamp}"
  execution.completed_at: "{ISO timestamp}" (if not already set)

Write updated index.json
```

### Step 4: Update Project State

```
Read .workflow/state.json

a. Find next pending phase:
   Scan .workflow/phases/*/index.json
   Find first phase where status == "pending" or status == "exploring" or status == "planning"
   next_phase = that phase number (or null if none)

b. Update state.json:
   current_phase: next_phase (or keep current if no next)
   phases_summary.completed: increment by 1
   phases_summary.in_progress: decrement by 1
   last_updated: "{ISO timestamp}"

c. If all phases completed:
   status: "idle"
   (All phases done)

Write updated state.json
```

### Step 5: Extract Learnings

```
a. Read reflection-log.md (if exists in phase directory):
   Extract key insights, strategy adjustments, patterns discovered
   Format as learning entries

b. Read verification.json (if exists):
   Extract resolved gaps — these represent patterns learned
   Extract successful verification strategies

c. Read validation.json (if exists):
   Extract test patterns that worked well
   Extract coverage insights

c2. Read review.json (if exists):
   Extract recurring findings patterns (e.g., "security issues in API handlers")
   Extract dimension-specific insights (e.g., "architecture coupling in module X")

d. Compile learnings:
   learnings = [
     { type: "pattern", content: "{discovered pattern}" },
     { type: "decision", content: "{strategy adjustment}" },
     { type: "pitfall", content: "{issue encountered and resolution}" }
   ]

e. If learnings found:
   For each learning:
     Append to .workflow/specs/learnings.md:
       ### [{type}] {summary} (Phase {NN})
       {content}
       *Extracted: {timestamp}*

   Display: "Extracted {count} learnings to specs/learnings.md"
```

### Step 5.1: Extract Issue Learnings

```
IF file exists ".workflow/issues/issues.jsonl":
  issues = read_ndjson(".workflow/issues/issues.jsonl")
  phase_issues = issues.filter(i => i.phase_ref == completing_phase_slug)

  // Extract pitfall learnings from completed issues with resolution
  FOR each issue in phase_issues where status == "completed" AND resolution != null:
    Append to .workflow/specs/learnings.md:
      ### [pitfall] {issue.title} (Phase {NN}, {issue.id})
      {issue.resolution}
      *Source: issue-resolution, Extracted: {timestamp}*

  // Auto-close remaining open non-critical issues
  FOR each issue in phase_issues where status NOT in ["completed", "failed", "deferred"]:
    Update issue in issues.jsonl:
      status: "completed"
      resolution: "phase_transitioned"
      resolved_at: now()
      updated_at: now()
    Append to issue.issue_history:
      { from: issue.status, to: "completed", changed_at: now(), actor: "phase-transition" }

  // Archive phase issues to history
  IF auto-closed issues exist:
    Append auto-closed issues to .workflow/issues/issue-history.jsonl
    Display: "Auto-closed {count} non-critical issues on phase transition"
```

### Step 6: Report and Route

```
Display completion summary:

  Phase {NN} ({title}) marked as COMPLETED

  Tasks: {completed}/{total}
  Verification: {verification.status}
  Review: {review.verdict or "not run"}
  Validation: {validation.status}
  Learnings extracted: {count}

Route to next action:

  If next_phase exists:
    "Next phase: {next_phase_number} - {next_phase_title}"
    Suggest: Skill({ skill: "maestro-plan", args: "{next_phase_number}" }) to begin planning,
             or Skill({ skill: "manage-status" }) to review

  If no next phase (all done):
    "All phases completed!"
    Suggest: Skill({ skill: "maestro-milestone-audit" })

  If warnings were present:
    "Note: Phase completed with warnings. Consider addressing them in a future phase."
```

---

## Error Handling

| Error | Action |
|-------|--------|
| state.json missing | Fail: "Run /workflow:init first" |
| Phase directory not found | Fail with available phase numbers |
| Phase already completed | Warn: "Phase already completed at {timestamp}. Re-transition? [y/N]" |
| index.json missing in phase dir | Fail: "Phase {NN} has no index.json" |
| Task JSON files missing | Count as incomplete tasks |
| W001 | Phase has warnings but no blockers — continue with user confirmation |
| W002 | UAT test failures exist (quality-test output) — review recommended before transition |
| W003 | Code review verdict is BLOCK — Skill({ skill: "quality-review" }) findings should be fixed first |
| W004 | Code review not yet run — Skill({ skill: "quality-review" }) recommended before transition |

## Output Files

| File | Action |
|------|--------|
| `.workflow/phases/{NN}-{slug}/index.json` | Updated: status="completed", completed_at set |
| `.workflow/state.json` | Updated: current_phase advanced, phases_summary updated |
| `.workflow/specs/learnings.md` | Appended with extracted learnings |

## State Transitions

```
Phase index.json:
  any status -> "completed"

Project state.json:
  current_phase -> next pending phase
  phases_summary.completed++
  phases_summary.in_progress--
```
