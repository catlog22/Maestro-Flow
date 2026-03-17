# Workflow: milestone-complete

Archive completed milestone and prepare for next.

---

## Step 1: Validation

1. Read `.workflow/state.json`:
   - Determine target milestone (from $ARGUMENTS or current_milestone)

2. Check milestone audit status:
   - Read `.workflow/milestone-audit-{milestone}.md` if exists
   - If no audit report exists:
     - WARN: "No audit report found. Run `/workflow:milestone-audit` first."
     - Ask user: "Complete without audit?"
     - If NO → exit with route to `/workflow:milestone-audit`

3. Verify all phases are completed:
   ```
   For each phase in milestone:
     Read phases/{NN}-{slug}/index.json
     if status != "completed":
       ERROR: "Phase {NN} ({title}) is not completed (status: {status})"
       Route: /workflow:execute {NN} or /workflow:verify {NN}
       EXIT
   ```

---

## Step 2: Create Milestone Archive

1. Create archive directory:
   ```
   mkdir -p .workflow/milestones/v{X.Y}/phases/
   ```

2. Snapshot roadmap:
   ```
   cp .workflow/roadmap.md .workflow/milestones/v{X.Y}/roadmap-snapshot.md
   ```

3. Archive phase directories:
   ```
   For each phase in milestone:
     cp -r .workflow/phases/{NN}-{slug}/ .workflow/milestones/v{X.Y}/phases/{NN}-{slug}/
   ```

4. Copy audit report:
   ```
   cp .workflow/milestone-audit-{milestone}.md .workflow/milestones/v{X.Y}/audit-report.md
   ```

---

## Step 2.5: Load Existing Learnings

```
existing_learnings = maestro spec load --category general
```

Check existing entries to avoid duplicates when appending in Step 3.

---

## Step 3: Extract Learnings

1. For each phase in milestone, read `reflection-log.md` if exists:
   - Extract strategy adjustments
   - Extract patterns discovered
   - Extract pitfalls encountered

2. Aggregate learnings and append to `.workflow/specs/learnings.md`:
   ```
   ## Milestone {milestone} Learnings ({date})

   ### Strategy Adjustments
   - {from reflection-log entries}

   ### Patterns Discovered
   - {from reflection-log entries}

   ### Pitfalls Encountered
   - {from reflection-log entries}
   ```

---

## Step 4: Update State

1. Update `.workflow/state.json`:
   ```json
   {
     "current_milestone": "v{X.Y+1}",  // increment minor version
     "current_phase": 1,                 // reset to 1
     "status": "idle",
     "phases_summary": {
       "total": 0,
       "completed": 0,
       "in_progress": 0,
       "pending": 0
     },
     "last_updated": "{timestamp}"
   }
   ```
   Preserve `accumulated_context` -- decisions and deferred items carry forward.

2. Clean up completed phase directories:
   - Remove `.workflow/phases/{NN}-{slug}/` for archived phases
   - Keep `.workflow/phases/` directory (empty, ready for new milestone)

---

## Step 5: Commit and Route

1. If git repo: commit with message `"chore: complete milestone {milestone}"`

2. Display completion summary:
   ```
   ====================================================
     MILESTONE COMPLETED: {milestone}
   ====================================================

   Archived:
     - {N} phases archived to .workflow/milestones/v{X.Y}/
     - Roadmap snapshot saved
     - Audit report archived
     - {M} learnings extracted to specs/learnings.md

   State reset:
     - Current milestone: v{X.Y+1}
     - Current phase: 1
     - Status: idle

   ====================================================
   ```

3. Route next steps:
   - Ask user: "Start planning next milestone?"
     - YES → Suggest Skill({ skill: "maestro-init" }) or Skill({ skill: "maestro-plan" }) for next milestone phases
     - NO → "Project is idle." Suggest Skill({ skill: "manage-status" }) to check state anytime.
