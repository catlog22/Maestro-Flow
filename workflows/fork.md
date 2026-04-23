# Workflow: fork

Create a git worktree for an entire milestone, enabling inter-milestone parallel development. Copies `.workflow/` context into the worktree since `.workflow/` is gitignored.

Worktrees operate at the **milestone level** — all phases within a milestone are owned by one worktree and executed sequentially inside it. Per-phase parallelism within a milestone is not supported.

---

## Step 1: Parse Arguments and Flags

```javascript
const getUtc8ISOString = () => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()

// Parse flags
const syncMode = $ARGUMENTS.includes('--sync')
const baseMatch = $ARGUMENTS.match(/--base\s+(\S+)/)
const baseBranch = baseMatch ? baseMatch[1] : 'HEAD'

// Parse milestone number: -m <N> or bare <N>
const mFlagMatch = $ARGUMENTS.match(/-m\s+(\d+)/)
const cleaned = $ARGUMENTS
  .replace(/--sync|--base\s+\S+|-m\s+\d+/g, '')
  .trim()
const bareNumMatch = cleaned.match(/^(\d+)$/)
const milestoneNum = mFlagMatch
  ? parseInt(mFlagMatch[1])
  : bareNumMatch
    ? parseInt(bareNumMatch[1])
    : null
```

---

## Step 2: Validate Prerequisites

```
IF NOT file_exists(".workflow/state.json"):
  ERROR E001: "Project not initialized. Run maestro-init first."
  EXIT

IF NOT file_exists(".workflow/roadmap.md"):
  ERROR E002: "No roadmap found. Run maestro-roadmap first."
  EXIT

IF file_exists(".workflow/worktree-scope.json"):
  ERROR E003: "Cannot fork from inside a worktree. Run from the main worktree."
  EXIT

IF milestoneNum === null:
  ERROR E004: "Milestone number required. Usage: maestro-fork -m <number>"
  EXIT

Read .workflow/state.json → projectState
Read .workflow/config.json → config (if exists, else use defaults)

worktreeRoot = config.worktree?.root ?? ".worktrees"
branchPrefix = config.worktree?.branch_prefix ?? "milestone/"
```

---

## Step 3: Resolve Milestone

```
// Lookup milestone by number from state.json.milestones[]
IF NOT projectState.milestones || NOT Array.isArray(projectState.milestones):
  ERROR E005: "No milestones defined in state.json."
  EXIT

// milestones[] is 0-indexed, milestoneNum is 1-based
milestoneEntry = projectState.milestones[milestoneNum - 1]

IF NOT milestoneEntry:
  availableList = projectState.milestones
    .map((m, i) => "  M" + (i + 1) + ": " + m.name + " (" + m.title + ")")
    .join("\n")
  ERROR E006: "Milestone {milestoneNum} not found.\nAvailable:\n{availableList}"
  EXIT

milestoneName = milestoneEntry.name       // e.g. "Production"
milestoneTitle = milestoneEntry.title      // e.g. "生产就绪"
milestonePhases = milestoneEntry.phases    // e.g. [3, 4]
milestoneSlug = milestoneName.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 40)
```

---

## Step 4: Sync Mode (--sync)

If `syncMode` is true, this is a sync operation on an existing worktree, not a fork.

```
IF syncMode:
  Read .workflow/worktrees.json → registry
  entry = registry.worktrees.find(w =>
    w.milestone_num === milestoneNum && w.status === "active"
  )

  IF NOT entry:
    ERROR E007: "No active worktree for milestone {milestoneNum} ({milestoneName})"
    EXIT

  // Step 4a: Pull source code
  Bash("cd {entry.path} && git merge main")
  IF conflict:
    WARN "Merge conflict in worktree. Resolve in {entry.path} before continuing."
    EXIT

  // Step 4b: Re-copy shared context
  Copy .workflow/project.md → {entry.path}/.workflow/project.md
  Copy .workflow/roadmap.md → {entry.path}/.workflow/roadmap.md
  Copy .workflow/config.json → {entry.path}/.workflow/config.json (if exists)
  Copy .workflow/specs/ → {entry.path}/.workflow/specs/ (if exists)

  Display "Worktree for M{milestoneNum} ({milestoneName}) synced with main."
  EXIT (sync complete)
```

---

## Step 5: Validate & Confirm

```
// Load phase status — artifact registry first, fallback to legacy phases/
phaseList = []
artifacts = projectState.artifacts ?? []
useArtifactRegistry = artifacts.length > 0

IF useArtifactRegistry:
  // Derive phase status from artifact registry
  for (phaseNum of milestonePhases):
    execArtifacts = artifacts.filter(a => a.type === 'execute' && a.phase === phaseNum)
    status = execArtifacts.some(a => a.status === 'completed') ? 'completed'
           : execArtifacts.length > 0 ? 'in_progress'
           : 'pending'
    phaseList.push({ phase: phaseNum, title: "Phase " + phaseNum, status })
ELSE:
  // Legacy: load from phases/ directory
  for (phaseNum of milestonePhases):
    Glob: .workflow/phases/{NN}-*/index.json where NN matches phaseNum
    Read index.json → phaseIndex
    phaseList.push(phaseIndex)

// Validate: milestone should have at least one non-completed phase
nonCompleted = phaseList.filter(p => p.status !== "completed")
IF nonCompleted.length === 0:
  Display "All phases in M{milestoneNum} ({milestoneName}) are already completed. Nothing to fork."
  EXIT

// Check for already-forked milestone
IF file_exists(".workflow/worktrees.json"):
  Read .workflow/worktrees.json → existingRegistry
  alreadyForked = existingRegistry.worktrees.find(w =>
    w.milestone_num === milestoneNum && w.status === "active"
  )
  IF alreadyForked:
    ERROR E008: "M{milestoneNum} already has an active worktree at {alreadyForked.path}. Merge or cleanup first."
    EXIT

Display "Fork Milestone {milestoneNum}: {milestoneName} ({milestoneTitle})"
Display "Phases ({phaseList.length}):"
for (p of phaseList):
  Display "  Phase {p.phase}: {p.title} [{p.status}]"

AskUserQuestion: "Create worktree for this milestone? (y/n)"
IF response !== 'y': EXIT
```

---

## Step 6: Create Worktree

```
const forkSessionId = "fork-" + getUtc8ISOString().substring(0, 19).replace(/[-:T]/g, '')
const baseCommit = Bash("git rev-parse HEAD").trim()
const branch = branchPrefix + milestoneSlug
const wtPath = worktreeRoot + "/m" + milestoneNum + "-" + milestoneSlug

// 6a: Clean up stale worktree/branch if exists
IF directory_exists(wtPath):
  Bash("git worktree remove --force {wtPath}") // ignore errors
Bash("git branch -D {branch}") // ignore errors (may not exist)

// 6b: Create worktree
Bash("git worktree add -b {branch} {wtPath} {baseBranch}")

// 6c: Create .workflow/ structure in worktree
Bash("mkdir -p {wtPath}/.workflow/scratch")

// 6d: Copy shared context (read-only)
Copy .workflow/project.md → {wtPath}/.workflow/project.md
Copy .workflow/roadmap.md → {wtPath}/.workflow/roadmap.md
IF file_exists(".workflow/config.json"):
  Copy .workflow/config.json → {wtPath}/.workflow/config.json
IF directory_exists(".workflow/specs"):
  Copy .workflow/specs/ → {wtPath}/.workflow/specs/

// 6e: Copy milestone artifacts to worktree
ownedPhaseNumbers = milestonePhases.slice()  // all phases in this milestone

IF useArtifactRegistry:
  // Copy scratch dirs for this milestone's artifacts
  milestoneArtifacts = artifacts.filter(a =>
    a.milestone === milestoneName && a.path
  )
  for (art of milestoneArtifacts):
    IF directory_exists(".workflow/" + art.path):
      Copy .workflow/{art.path}/ → {wtPath}/.workflow/{art.path}/
ELSE:
  // Legacy: copy phase directories
  Bash("mkdir -p {wtPath}/.workflow/phases")
  for (p of phaseList):
    NN = String(p.phase).padStart(2, '0')
    Copy .workflow/phases/{NN}-{p.slug}/ → {wtPath}/.workflow/phases/{NN}-{p.slug}/

// 6f: Copy dependency artifacts (phases outside this milestone)
IF useArtifactRegistry:
  // Collect dependency phases from roadmap milestone entry
  // (cross-milestone dependencies are defined in milestoneEntry.depends_on or roadmap)
  depPhases = new Set()
  IF milestoneEntry.depends_on:
    for (dep of milestoneEntry.depends_on):
      IF NOT ownedPhaseNumbers.includes(dep):
        depPhases.add(dep)
  // Copy dependency artifacts from main
  for (dep of depPhases):
    depArtifacts = artifacts.filter(a => a.phase === dep && a.path)
    for (art of depArtifacts):
      IF directory_exists(".workflow/" + art.path):
        Copy .workflow/{art.path}/ → {wtPath}/.workflow/{art.path}/
ELSE:
  // Legacy: copy completed dependency phase dirs
  allDeps = new Set()
  for (p of phaseList):
    IF p.depends_on:
      for (dep of p.depends_on):
        IF NOT ownedPhaseNumbers.includes(dep):
          allDeps.add(dep)
  for (dep of allDeps):
    depNN = String(dep).padStart(2, '0')
    Glob: .workflow/phases/{depNN}-*/index.json
    Read → depIndex
    Copy .workflow/phases/{depNN}-{depIndex.slug}/ → {wtPath}/.workflow/phases/{depNN}-{depIndex.slug}/

// 6g: Build phase_dependencies map for worktree-scope
phaseDeps = {}
IF useArtifactRegistry:
  IF milestoneEntry.depends_on:
    for (phaseNum of ownedPhaseNumbers):
      phaseDeps[String(phaseNum)] = milestoneEntry.depends_on
        .filter(d => !ownedPhaseNumbers.includes(d))
ELSE:
  for (p of phaseList):
    IF p.depends_on:
      externalDeps = p.depends_on.filter(d => !ownedPhaseNumbers.includes(d))
      IF externalDeps.length > 0:
        phaseDeps[String(p.phase)] = externalDeps

// 6h: Write worktree-scope.json
Write {wtPath}/.workflow/worktree-scope.json:
  {
    "worktree": true,
    "milestone_num": milestoneNum,
    "milestone": milestoneName,
    "owned_phases": ownedPhaseNumbers,
    "phase_dependencies": phaseDeps,
    "main_worktree": resolve(cwd),
    "branch": branch,
    "base_commit": baseCommit,
    "created_at": getUtc8ISOString()
  }

// 6i: Write scoped state.json
Read .workflow/state.json → mainState
firstPending = phaseList.find(p => p.status !== "completed")
scopedState = {
  ...mainState,
  current_phase: firstPending?.phase ?? phaseList[0].phase,
  current_milestone: milestoneName,
  // Carry over milestone-scoped artifacts to worktree
  artifacts: useArtifactRegistry
    ? artifacts.filter(a => a.milestone === milestoneName || ownedPhaseNumbers.includes(a.phase))
    : []
}
Write {wtPath}/.workflow/state.json: scopedState
```

---

## Step 7: Update Main Registry

```
IF file_exists(".workflow/worktrees.json"):
  Read .workflow/worktrees.json → registry
ELSE:
  registry = { version: "1.0", worktrees: [], fork_sessions: [] }

registry.worktrees.push({
  milestone_num: milestoneNum,
  milestone: milestoneName,
  slug: milestoneSlug,
  branch: branch,
  path: wtPath,
  base_commit: baseCommit,
  status: "active",
  created_at: getUtc8ISOString(),
  owned_phases: ownedPhaseNumbers,
  fork_session: forkSessionId
})

registry.fork_sessions.push({
  session_id: forkSessionId,
  created_at: getUtc8ISOString(),
  milestone_num: milestoneNum,
  milestone: milestoneName,
  base_branch: baseBranch,
  base_commit: baseCommit
})

Write .workflow/worktrees.json: registry

// Mark milestone phases as "forked"
IF useArtifactRegistry:
  // In artifact registry model, worktrees.json tracks forked state.
  // No per-phase marking needed — the registry entry signals ownership.
  // (worktrees.json already updated above with owned_phases)
ELSE:
  // Legacy: mark phase index.json as forked
  for (p of phaseList):
    IF p.status !== "completed":
      NN = String(p.phase).padStart(2, '0')
      Read .workflow/phases/{NN}-{p.slug}/index.json → idx
      idx.status = "forked"
      idx.updated_at = getUtc8ISOString()
      Write .workflow/phases/{NN}-{p.slug}/index.json: idx

mainState.last_updated = getUtc8ISOString()
Write .workflow/state.json: mainState
```

---

## Step 8: Display Summary

```
Display:
  === FORK COMPLETE ===
  Session:    {forkSessionId}
  Base:       {baseBranch} ({baseCommit.substring(0, 7)})
  Milestone:  M{milestoneNum} — {milestoneName} ({milestoneTitle})
  Branch:     {branch}
  Path:       {wtPath}
  Phases:     {ownedPhaseNumbers.join(', ')}

  Next steps (run in the worktree):
    cd {wtPath}

    # Sequential lifecycle for each phase:
    /maestro-analyze {firstPending.phase}
    /maestro-plan {firstPending.phase}
    /maestro-execute {firstPending.phase}
    /maestro-verify {firstPending.phase}
    # ... repeat for next phases in milestone

  Or delegate (automated):
    maestro delegate "run full lifecycle for milestone" --cd {wtPath} --mode write

  Sync worktree with main (if needed later):
    /maestro-fork -m {milestoneNum} --sync

  When all phases in milestone complete:
    /maestro-merge -m {milestoneNum}
```
