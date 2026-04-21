---
name: maestro-merge
description: Two-phase merge of milestone worktree branch back — git merge first, artifact sync only on success. Registry health check, pre-merge rebase, atomic state reconciliation.
argument-hint: "-m <milestone-number> [--force] [--dry-run] [--no-cleanup] [--continue]"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
---

<purpose>
Merge a completed milestone worktree branch back into main, sync workflow artifacts,
and reconcile project state. Two-phase approach: git merge first (source code),
artifact sync second (only after git succeeds). Prevents partial state corruption
when merge conflicts occur.
</purpose>

<required_reading>
@~/.maestro/workflows/merge.md
</required_reading>

<context>
$ARGUMENTS — milestone number and optional flags.

**Flags:**
- `-m <N>` or bare `<N>`: Milestone number
- `--force`: Merge even if not all phases completed
- `--dry-run`: Show what would be merged
- `--no-cleanup`: Keep worktree and branch after merge
- `--continue`: Resume merge paused due to git conflict

**Merge sequence:**
1. Registry health check → 2. Phase readiness validation → 3. Pre-merge rebase →
4. Git merge (source) → 5. Artifact sync (.workflow/) → 6. State reconciliation → 7. Cleanup
</context>

<execution>
Follow '~/.maestro/workflows/merge.md' completely.

**Next steps:**
- View dashboard → `$manage-status`
- Audit milestone → `$maestro-milestone-audit`
</execution>

<error_codes>
| Code | Severity | Condition | Recovery |
|------|----------|-----------|----------|
| E001 | error | Running inside a worktree | Run from main worktree |
| E002 | error | No worktree registry found | Nothing to merge |
| E003 | error | --continue but no merge state | Start fresh merge |
| E004 | error | No milestone number | Provide `-m <N>` |
| W001 | warning | Stale registry entries | Auto-cleaned |
| W002 | warning | Incomplete phases without --force | Confirm or use --force |
| W003 | warning | Conflict pulling main into worktree | Resolve first |
</error_codes>

<success_criteria>
- [ ] Registry health check passed
- [ ] Pre-merge rebase successful
- [ ] Git merge completed (or conflicts resolved via --continue)
- [ ] Phase artifacts synced to main `.workflow/`
- [ ] `state.json` reconciled
- [ ] Worktree removed and branch deleted (unless --no-cleanup)
- [ ] Registry updated
</success_criteria>
