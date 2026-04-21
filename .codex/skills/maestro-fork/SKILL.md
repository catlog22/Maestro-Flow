---
name: maestro-fork
description: Create git worktree for milestone-level parallel development, or sync existing worktree with main. Copies .workflow/ context into worktree since it is gitignored.
argument-hint: "-m <milestone-number> [--base <branch>] [--sync]"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
---

<purpose>
Create a git worktree for an entire milestone, enabling inter-milestone parallel development.
All phases within the milestone are owned by the worktree. Since `.workflow/` is gitignored,
this command explicitly copies project context and milestone phase directories into the worktree.

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

**Worktree layout:** `.worktrees/m{N}-{slug}/` with scoped `.workflow/`
</context>

<execution>
Follow '~/.maestro/workflows/fork.md' completely.

**Next steps:**
- Fork → `cd {wt.path} && $maestro-analyze {first_phase}`
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
- [ ] Milestone phases identified from roadmap
- [ ] Git worktree created with branch `milestone/{slug}`
- [ ] `.workflow/` context copied (all milestone + dependency phases)
- [ ] `worktree-scope.json` written with owned phase numbers
- [ ] `worktrees.json` registry updated in main worktree

Sync mode:
- [ ] Git merge main into worktree branch
- [ ] Shared artifacts re-copied
- [ ] Conflicts reported if any
</success_criteria>
