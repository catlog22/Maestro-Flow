# Workflow: merge

Two-phase merge of a completed milestone worktree branch back into main. Phase 1: git merge (source code). Phase 2: artifact sync (workflow state). Artifact sync only proceeds after successful git merge.

Merges operate at the **milestone level** — one worktree per milestone, all phases merged together.

---

## Step 1: Parse Arguments and Flags

```javascript
const getUtc8ISOString = () => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()

const force = $ARGUMENTS.includes('--force')
const dryRun = $ARGUMENTS.includes('--dry-run')
const noCleanup = $ARGUMENTS.includes('--no-cleanup')
const continueMode = $ARGUMENTS.includes('--continue')

// Parse milestone number: -m <N> or bare <N>
const mFlagMatch = $ARGUMENTS.match(/-m\s+(\d+)/)
const cleaned = $ARGUMENTS
  .replace(/--force|--dry-run|--no-cleanup|--continue|-m\s+\d+/g, '')
  .trim()
const bareNumMatch = cleaned.match(/^(\d+)$/)
const milestoneNum = mFlagMatch
  ? parseInt(mFlagMatch[1])
  : bareNumMatch
    ? parseInt(bareNumMatch[1])
    : null
```

---

## Step 2: Validate Context

```
IF file_exists(".workflow/worktree-scope.json"):
  ERROR E001: "Cannot merge from inside a worktree. Run from the main worktree."
  EXIT

IF NOT file_exists(".workflow/worktrees.json"):
  ERROR E002: "No worktree registry found. Nothing to merge."
  EXIT

Read .workflow/worktrees.json → registry
```

---

## Step 3: Registry Health Check

```
staleEntries = []
for (entry of registry.worktrees):
  IF NOT directory_exists(entry.path):
    staleEntries.push(entry)

IF staleEntries.length > 0:
  WARN W001: "Found {staleEntries.length} stale worktree entries (directories missing):"
  for (entry of staleEntries):
    Display "  M{entry.milestone_num} ({entry.milestone}): {entry.path} — MISSING"
  registry.worktrees = registry.worktrees.filter(w => !staleEntries.includes(w))
  Write .workflow/worktrees.json: registry
```

---

## Step 4: Resolve Merge Target

```
IF continueMode:
  IF NOT file_exists(".workflow/.merge-state.json"):
    ERROR E003: "--continue but no merge state found. Start a fresh merge."
    EXIT
  Read .workflow/.merge-state.json → mergeState
  target = mergeState.target
  GOTO Step_7

ELSE IF milestoneNum !== null:
  target = registry.worktrees.find(w =>
    w.milestone_num === milestoneNum && w.status === "active"
  )
ELSE:
  ERROR E004: "Milestone number required. Usage: maestro-merge -m <number>"
  EXIT

IF NOT target:
  activeList = registry.worktrees
    .filter(w => w.status === "active")
    .map(w => "  M" + w.milestone_num + ": " + w.milestone + " (" + w.path + ")")
    .join("\n")
  Display "No active worktree for milestone {milestoneNum}."
  IF activeList:
    Display "Active worktrees:\n{activeList}"
  EXIT
```

---

## Step 5: Validate Readiness

```
completedPhases = []
incompletePhases = []

// Read worktree state for artifact registry check
Read {target.path}/.workflow/state.json → wtState (if exists)
wtArtifacts = wtState?.artifacts ?? []

// Check phase completeness via artifact registry
for (phaseNum of target.owned_phases):
  execArtifacts = wtArtifacts.filter(a => a.type === 'execute' && a.phase === phaseNum)
  IF execArtifacts.some(a => a.status === 'completed'):
    completedPhases.push({ phase: phaseNum })
  ELSE:
    status = execArtifacts.length > 0 ? execArtifacts[0].status : 'no_execute_artifact'
    incompletePhases.push({ phase: phaseNum, status })

IF incompletePhases.length > 0 AND NOT force:
  WARN W002: "M{target.milestone_num} ({target.milestone}) has incomplete phases:"
  for (p of incompletePhases):
    Display "  Phase {p.phase}: {p.status}"
  IF NOT dryRun:
    AskUserQuestion: "Merge anyway? (y/n, or use --force)"
    IF response !== 'y': EXIT

IF dryRun:
  Display "=== DRY RUN ==="
  Display "  Would merge: {target.branch} → current branch"
  Display "  Milestone: M{target.milestone_num} ({target.milestone})"
  Display "  Completed: {completedPhases.map(p => p.phase).join(', ')}"
  Display "  Incomplete: {incompletePhases.map(p => p.phase + '(' + p.status + ')').join(', ')}"
  EXIT
```

---

## Step 6: Phase 1 — Git Merge

```
Display "=== Merging M{target.milestone_num}: {target.milestone} ==="

// 6a: Pre-merge rebase
Display "Pulling main into worktree branch..."
rebaseResult = Bash("cd {target.path} && git merge main --no-edit 2>&1")

IF rebaseResult.exitCode !== 0:
  WARN W003: "Conflict pulling main into worktree. Resolve in {target.path} first."
  Display rebaseResult.output
  Display "After resolving: cd {target.path} && git merge --continue"
  Display "Then retry: /maestro-merge -m {target.milestone_num}"
  EXIT

// 6b: Merge worktree branch into main
Display "Merging {target.branch} into current branch..."
mergeResult = Bash("git merge {target.branch} --no-ff -m 'merge: M{target.milestone_num} {target.milestone}' 2>&1")

IF mergeResult.exitCode !== 0:
  Display "MERGE CONFLICT detected."
  Display mergeResult.output

  Write .workflow/.merge-state.json:
    {
      "target": target,
      "phase": "git_merge_conflict",
      "created_at": getUtc8ISOString()
    }

  Display ""
  Display "Resolve conflicts, then:"
  Display "  git add <resolved-files> && git merge --continue"
  Display "  /maestro-merge --continue"
  EXIT

Display "Git merge successful."
```

---

## Step 7: Phase 2 — Artifact Sync

```
Step_7:

Display "Syncing workflow artifacts for M{target.milestone_num} ({target.milestone})..."

Read .workflow/state.json → mainState

// 7a: Copy scratch dirs from worktree to main
Read {target.path}/.workflow/state.json → wtState
wtArtifacts = wtState?.artifacts ?? []
milestoneArtifacts = wtArtifacts.filter(a =>
  a.path && (a.milestone === target.milestone || target.owned_phases.includes(a.phase))
)
for (art of milestoneArtifacts):
  srcDir = target.path + "/.workflow/" + art.path
  dstDir = ".workflow/" + art.path
  IF directory_exists(srcDir):
    Bash("mkdir -p {dstDir} && cp -r {srcDir}/* {dstDir}/")

// 7b: Merge artifact registries
mainArtifacts = mainState.artifacts ?? []
existingIds = new Set(mainArtifacts.map(a => a.id))
for (art of wtArtifacts):
  IF existingIds.has(art.id):
    // Update existing artifact status
    idx = mainArtifacts.findIndex(a => a.id === art.id)
    mainArtifacts[idx] = art
  ELSE:
    mainArtifacts.push(art)
mainState.artifacts = mainArtifacts

// Record merge in transition history
mainState.transition_history = mainState.transition_history ?? []
mainState.transition_history.push({
  milestone_num: target.milestone_num,
  milestone: target.milestone,
  action: "worktree_merge",
  completed_at: getUtc8ISOString(),
  branch: target.branch,
  phases: target.owned_phases
})

// Merge accumulated context from worktree
IF wtState?.accumulated_context:
  for (decision of (wtState.accumulated_context.key_decisions ?? [])):
    IF NOT mainState.accumulated_context.key_decisions.includes(decision):
      mainState.accumulated_context.key_decisions.push(decision)
  for (deferred of (wtState.accumulated_context.deferred ?? [])):
    mainState.accumulated_context.deferred.push(deferred)

mainState.last_updated = getUtc8ISOString()
Write .workflow/state.json: mainState

// 7c: Update roadmap.md (mark completed phases)
Read .workflow/roadmap.md → roadmap
for (phaseNum of target.owned_phases):
  isCompleted = completedPhases.some(p => p.phase === phaseNum)
  IF isCompleted:
    Append " ✅ COMPLETED" to phase title line in roadmap
Write .workflow/roadmap.md: roadmap
```

---

## Step 8: Cleanup

```
IF NOT noCleanup:
  Display "Cleaning up worktree..."
  Bash("git worktree remove --force {target.path}")
  Bash("git branch -D {target.branch}")

registry.worktrees = registry.worktrees.filter(w =>
  !(w.milestone_num === target.milestone_num && w.branch === target.branch)
)
Write .workflow/worktrees.json: registry

IF file_exists(".workflow/.merge-state.json"):
  Bash("rm .workflow/.merge-state.json")
```

---

## Step 9: Summary

```
Display:
  === MERGE COMPLETE ===
  Milestone:  M{target.milestone_num} — {target.milestone}
  Branch:     {target.branch}
  Phases:     {target.owned_phases.join(', ')}
  Completed:  {completedPhases.length}/{target.owned_phases.length}

  State:   .workflow/state.json updated
  Roadmap: .workflow/roadmap.md updated

  Next steps:
    Skill({ skill: "manage-status" })          -- View dashboard
    Skill({ skill: "maestro-milestone-audit" }) -- Audit merged milestone
```
