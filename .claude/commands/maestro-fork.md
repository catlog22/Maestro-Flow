---
name: maestro-fork
description: Create a worktree for milestone-level parallel development, or sync existing worktree with main
argument-hint: "-m <milestone-number> [--base <branch>] [--sync]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Agent
  - AskUserQuestion
---
<purpose>
Create a git worktree for an entire milestone, enabling inter-milestone parallel development. All phases within the milestone are owned by the worktree and executed sequentially inside it.

Since `.workflow/` is gitignored, this command explicitly copies project context and all milestone phase directories into the worktree. Per-phase parallelism within a milestone is NOT supported.

Also supports `--sync` mode to pull latest main branch changes and shared artifacts into an active worktree (prevents source and artifact drift for long-lived worktrees).

Produces `.workflow/worktrees.json` registry in the main worktree and `.workflow/worktree-scope.json` marker in the worktree.
</purpose>

<required_reading>
@~/.maestro/workflows/fork.md
</required_reading>

<deferred_reading>
- [worktrees.json](~/.maestro/templates/worktrees.json) — read when updating registry
- [worktree-scope.json](~/.maestro/templates/worktree-scope.json) — read when writing scope marker
</deferred_reading>

<context>
$ARGUMENTS -- milestone name and optional flags.

**Modes:**

| Mode | Trigger | Behavior |
|------|---------|----------|
| Fork | `-m 2` or `2` | Create worktree for all phases in milestone 2 |
| Sync | `-m 2 --sync` | Sync existing milestone 2 worktree with main branch |

**Flags:**
- `-m <N>` or bare `<N>`: Milestone number (1-based, maps to `state.json.milestones[]`)
- `--base <branch>`: Override base branch for worktree creation (default: HEAD)
- `--sync`: Sync mode — pull main into existing worktree, re-copy shared artifacts

**Milestone resolution:** `state.json.milestones[N-1]` → `{name, title, phases: [...]}`

**Worktree layout:**
```
.worktrees/m{N}-{slug}/
├── .workflow/
│   ├── worktree-scope.json     (scope marker — lists all owned phases)
│   ├── state.json              (scoped to this milestone)
│   ├── project.md              (read-only copy)
│   ├── roadmap.md              (read-only copy)
│   ├── config.json             (read-only copy)
│   ├── specs/                  (read-only copy)
│   └── phases/
│       ├── {NN}-{slug}/        (owned — all phases in milestone)
│       └── {dep}-{dep-slug}/   (read-only dependency reference from prior milestones)
└── <source code>               (git worktree checkout)
```
</context>

<execution>
Follow '~/.maestro/workflows/fork.md' completely.

**Next-step routing on completion:**

Fork mode:
- Enter worktree → `cd {wt.path} && /maestro-analyze {first_phase}`
- Automated → `maestro delegate "run full lifecycle for milestone" --cd {wt.path} --mode write`
- Status → Skill({ skill: "manage-status" })

Sync mode:
- Sync complete → resume work in worktree
- Conflicts found → resolve manually, then retry
</execution>

<error_codes>
| Code | Severity | Condition | Recovery |
|------|----------|-----------|----------|
| E001 | error | Project not initialized | Run maestro-init first |
| E002 | error | No roadmap found | Run maestro-roadmap first |
| E003 | error | Running inside a worktree | Run from main worktree |
| E004 | error | No milestone number provided | Provide `-m <N>` |
| E005 | error | No milestones defined in state.json | Run maestro-roadmap first |
| E006 | error | Milestone number out of range | Check available milestones |
| E007 | error | No active worktree for milestone (--sync) | Check worktrees.json |
| E008 | error | Milestone already has active worktree | Merge or cleanup first |
</error_codes>

<success_criteria>
Fork mode:
- [ ] Milestone phases identified from roadmap
- [ ] Git worktree created with branch (`milestone/{slug}`)
- [ ] `.workflow/` context copied into worktree (all milestone phases + dependency phases)
- [ ] `worktree-scope.json` written with all owned phase numbers
- [ ] Scoped `state.json` written (current_phase = first pending phase)
- [ ] `worktrees.json` registry updated in main worktree
- [ ] Milestone phase indexes marked as "forked" in main worktree
- [ ] Summary displayed with next-step commands

Sync mode:
- [ ] Git merge main into worktree branch
- [ ] Shared artifacts re-copied (project.md, roadmap.md, config.json, specs/)
- [ ] Conflicts reported if any
</success_criteria>
