---
name: maestro-fork
description: Create git worktree for milestone-level parallel development, or sync existing worktree with main. Copies .workflow/ context and scratch artifacts into worktree since .workflow/ is gitignored.
argument-hint: "-m <milestone-number> [--base <branch>] [--sync]"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
---

<purpose>
Create a git worktree for an entire milestone, enabling inter-milestone parallel development.
The worktree scope is milestone-level — all scratch artifacts for that milestone are owned by
the worktree. Since `.workflow/` is gitignored, this command explicitly copies project context
and milestone scratch artifacts into the worktree.

Also supports `--sync` mode to pull latest main into an active worktree.
</purpose>

<required_reading>
@~/.maestro/workflows/fork.md
</required_reading>

<context>
$ARGUMENTS — milestone number and optional flags.

**Modes:**
| Mode | Trigger | Behavior |
|------|---------|----------|
| Fork | `-m 2` or `2` | Create worktree for milestone 2 |
| Sync | `-m 2 --sync` | Sync existing worktree with main |

**Flags:**
- `-m <N>` or bare `<N>`: Milestone number
- `--base <branch>`: Override base branch (default: HEAD)
- `--sync`: Pull main into existing worktree, re-copy shared artifacts

**Worktree layout:**
```
.worktrees/m{N}-{slug}/
├── .workflow/
│   ├── worktree-scope.json     (milestone scope marker)
│   ├── state.json              (scoped — this milestone's artifacts only)
│   ├── project.md, roadmap.md, config.json, specs/  (read-only copies)
│   └── scratch/                (milestone's existing + new artifacts)
└── <source code>
```

**Artifact scoping:**
Fork copies scratch artifacts belonging to the target milestone (filtered from `state.json.artifacts[]` where `milestone == target`). New work creates scratch artifacts normally, registered in the worktree's local `state.json`.
</context>

<execution>
Follow '~/.maestro/workflows/fork.md' completely.

**Fork flow:**
1. Validate: initialized, roadmap exists, not inside worktree, milestone not forked
2. Resolve milestone: `state.json.milestones[N-1]`
3. Create worktree: `git worktree add -b milestone/{slug} .worktrees/m{N}-{slug} HEAD`
4. Copy `.workflow/`: shared files + milestone scratch artifacts
5. Write `worktree-scope.json` with milestone scope
6. Write scoped `state.json` (this milestone's artifacts only)
7. Update main: `worktrees.json` registry, mark milestone `"forked"`

**Sync flow:**
1. Find worktree from `worktrees.json`
2. `cd worktree && git merge main`
3. Re-copy shared files (project.md, roadmap.md, config.json, specs/)

**Next steps:**
- Fork → `cd {wt.path} && $maestro-analyze`
- Sync → resume work in worktree
</execution>

<error_codes>
| Code | Severity | Condition | Recovery |
|------|----------|-----------|----------|
| E001 | error | Project not initialized | Run maestro-init |
| E002 | error | No roadmap found | Run maestro-roadmap |
| E003 | error | Running inside a worktree | Run from main worktree |
| E004 | error | No milestone number | Provide `-m <N>` |
| E006 | error | Milestone out of range | Check available milestones |
| E008 | error | Milestone already has active worktree | Merge or cleanup first |
</error_codes>

<success_criteria>
Fork mode:
- [ ] Milestone resolved from state.json.milestones[]
- [ ] Git worktree created with branch `milestone/{slug}`
- [ ] Shared `.workflow/` files copied (project.md, roadmap.md, config.json, specs/)
- [ ] Milestone scratch artifacts copied (filtered from artifact registry)
- [ ] `worktree-scope.json` written with milestone scope
- [ ] Scoped `state.json` written (this milestone's artifacts only)
- [ ] `worktrees.json` registry updated in main worktree
- [ ] Milestone marked `"forked"` in main state.json

Sync mode:
- [ ] Git merge main into worktree branch
- [ ] Shared artifacts re-copied
- [ ] Conflicts reported if any
</success_criteria>
