---
name: maestro-merge
description: Two-phase merge of milestone worktree branch back — git merge first, artifact sync only on success
argument-hint: "-m <milestone-number> [--force] [--dry-run] [--no-cleanup] [--continue]"
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
Merge a completed milestone worktree branch back into the main branch, sync workflow artifacts for all phases, and reconcile project state. Uses a two-phase approach: git merge first (source code), artifact sync second (only after git succeeds). This prevents partial state corruption when merge conflicts occur.

Includes registry health check, pre-merge rebase (pull main into worktree to minimize conflicts), and atomic state reconciliation (patch, don't overwrite).
</purpose>

<required_reading>
@~/.maestro/workflows/merge.md
</required_reading>

<context>
$ARGUMENTS -- milestone name and optional flags.

**Flags:**
- `-m <N>` or bare `<N>`: Milestone number (1-based, maps to registry)
- `--force`: Merge even if not all phases are completed
- `--dry-run`: Show what would be merged without executing
- `--no-cleanup`: Keep worktree and branch after merge (for inspection)
- `--continue`: Resume a merge that was paused due to git conflict

**Merge sequence:**
1. Registry health check (remove stale entries)
2. Validate phase readiness across all owned phases
3. Pre-merge rebase (`git merge main` in worktree)
4. Phase 1: Git merge (source code only)
5. Phase 2: Artifact sync (only after git merge succeeds)
6. Atomic state reconciliation
7. Cleanup (worktree remove + branch delete)

**Conflict handling:**
If git merge fails, the command saves state to `.workflow/.merge-state.json` and exits. User resolves conflicts, then runs `maestro-merge --continue` to resume artifact sync.
</context>

<execution>
Follow '~/.maestro/workflows/merge.md' completely.

**Next-step routing on completion:**
- View dashboard → Skill({ skill: "manage-status" })
- Audit milestone → Skill({ skill: "maestro-milestone-audit" })
</execution>

<error_codes>
| Code | Severity | Condition | Recovery |
|------|----------|-----------|----------|
| E001 | error | Running inside a worktree | Run from main worktree |
| E002 | error | No worktree registry found | Nothing to merge |
| E003 | error | --continue but no merge state | Start fresh merge |
| E004 | error | No milestone number provided | Provide `-m <N>` |
| W001 | warning | Stale registry entries found | Auto-cleaned |
| W002 | warning | Incomplete phases (without --force) | Confirm or use --force |
| W003 | warning | Conflict pulling main into worktree | Resolve in worktree first |
</error_codes>

<success_criteria>
- [ ] Registry health check passed (stale entries cleaned)
- [ ] Pre-merge rebase successful (worktree has latest main)
- [ ] Git merge completed without conflicts (or conflicts resolved via --continue)
- [ ] All owned phase artifacts synced to main `.workflow/phases/`
- [ ] `state.json` reconciled (phases_summary, accumulated_context, transition_history patched)
- [ ] `roadmap.md` completed phases marked
- [ ] Worktree removed and branch deleted (unless --no-cleanup)
- [ ] Registry updated (entry removed)
</success_criteria>
