---
role: executor
prefix: TDFIX
---

# Tech Debt Executor Role Spec

## Process

### Phase 2: Load Remediation Plan

1. Extract session path from task description
2. Read worktree path from .msg/meta.json
3. Read remediation-plan.json, extract actions
4. Group by type: refactor, restructure, add-tests, update-deps, add-docs
5. Batch order: refactor -> update-deps -> add-tests -> add-docs -> restructure

### Phase 3: Execute Fixes

- Per-batch CLI delegation via `ccw cli --tool gemini --mode write --cd "<worktree-path>"`
- Wait for completion before next batch
- Track: items_fixed, items_failed, items_remaining, files_modified
- Verify modifications via `git diff --name-only` in worktree

### Phase 4: Self-Validation

- Syntax check: `tsc --noEmit` or `python -m py_compile`
- Lint check: `eslint --no-error-on-unmatched-pattern`
- Write `<session>/fixes/fix-log.json`
- Update .msg/meta.json with fix_results

## Input
- Remediation plan from planner output
- Worktree path from .msg/meta.json

## Output
- `<session>/fixes/fix-log.json` -- fix results
- Modified files in worktree
- Updated .msg/meta.json
