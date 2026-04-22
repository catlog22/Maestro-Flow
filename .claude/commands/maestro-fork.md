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
Create a git worktree for an entire milestone, enabling inter-milestone parallel development. The worktree scope is milestone-level — all scratch artifacts for that milestone are owned by the worktree.

Since `.workflow/` is gitignored, this command explicitly copies project context and existing milestone scratch artifacts into the worktree. Per-phase parallelism within a milestone is NOT supported.

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
| Fork | `-m 2` or `2` | Create worktree for milestone 2 |
| Sync | `-m 2 --sync` | Sync existing milestone 2 worktree with main branch |

**Flags:**
- `-m <N>` or bare `<N>`: Milestone number (1-based, maps to `state.json.milestones[]`)
- `--base <branch>`: Override base branch for worktree creation (default: HEAD)
- `--sync`: Sync mode — pull main into existing worktree, re-copy shared artifacts

**Milestone resolution:** `state.json.milestones[N-1]` → `{id, name, status}`

**Worktree layout:**
```
.worktrees/m{N}-{slug}/
├── .workflow/
│   ├── worktree-scope.json     (milestone scope marker)
│   ├── state.json              (scoped — only this milestone's artifacts)
│   ├── project.md              (read-only copy)
│   ├── roadmap.md              (read-only copy)
│   ├── config.json             (read-only copy)
│   ├── specs/                  (read-only copy)
│   └── scratch/                (milestone's existing + new artifacts)
│       ├── analyze-auth-2026-04-20/
│       ├── plan-auth-2026-04-20/
│       └── ...
└── <source code>               (git worktree checkout)
```

**Artifact scoping:**
Fork copies scratch artifacts that belong to the target milestone (filtered from `state.json.artifacts[]` where `milestone == target`). New work in the worktree creates scratch artifacts normally; they are registered in the worktree's local `state.json`.
</context>

<execution>
Follow '~/.maestro/workflows/fork.md' completely.

**Fork flow:**
1. Validate: project initialized, roadmap exists, not inside worktree, milestone not already forked
2. Resolve milestone: `state.json.milestones[N-1]`
3. Create git worktree: `git worktree add -b milestone/{slug} .worktrees/m{N}-{slug} HEAD`
4. Copy `.workflow/` into worktree:
   - Shared files (read-only): `project.md`, `roadmap.md`, `config.json`, `specs/`
   - Milestone scratch artifacts: filter `state.json.artifacts[]` by `milestone == target`, copy each `scratch/{path}`
5. Write scope marker: `worktree-scope.json` with milestone number and main path
6. Write scoped `state.json`: only this milestone's artifacts, `current_milestone` set
7. Update main: `worktrees.json` registry, mark milestone as `"forked"` in `state.json.milestones[]`

**Sync flow:**
1. Find worktree from `worktrees.json`
2. `cd worktree && git merge main`
3. Re-copy shared files: `project.md`, `roadmap.md`, `config.json`, `specs/`
4. Report conflicts if any

**Next-step routing on completion:**

Fork mode:
- Enter worktree → `cd {wt.path} && /maestro-analyze`
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
- [ ] Milestone resolved from state.json.milestones[]
- [ ] Git worktree created with branch (`milestone/{slug}`)
- [ ] Shared `.workflow/` files copied (project.md, roadmap.md, config.json, specs/)
- [ ] Milestone scratch artifacts copied (filtered from artifact registry)
- [ ] `worktree-scope.json` written with milestone scope
- [ ] Scoped `state.json` written (only this milestone's artifacts)
- [ ] `worktrees.json` registry updated in main worktree
- [ ] Milestone marked as `"forked"` in main `state.json.milestones[]`
- [ ] Summary displayed with next-step commands

Sync mode:
- [ ] Git merge main into worktree branch
- [ ] Shared artifacts re-copied (project.md, roadmap.md, config.json, specs/)
- [ ] Conflicts reported if any
</success_criteria>
