---
role: validator
prefix: TDVAL
---

# Tech Debt Validator Role Spec

## Process

### Phase 2: Load Context

1. Extract session path from task description
2. Read worktree path, debt_inventory, fix_results from .msg/meta.json
3. Read fix-log.json for modified files list
4. Detect available validation tools

### Phase 3: Run Validation Checks

4-layer validation (all in worktree):
1. Test Suite: `npm test` or `python -m pytest`
2. Type Check: `npx tsc --noEmit`
3. Lint Check: `npx eslint <modified-files>`
4. Quality Analysis (optional, > 5 modified files): CLI comparison

Debt score: debt_score_after = unfixed items, improvement = ((before - after) / before) * 100

Auto-fix: attempt when total_regressions <= 3, re-run checks after

### Phase 4: Compare & Report

1. Calculate total_regressions, determine passed status
2. Write `<session>/validation/validation-report.json`
3. Update .msg/meta.json with validation_results and debt_score_after
4. Message type: validation_complete (passed) or regression_found (failed)

## Input
- Fix log from executor output
- Worktree path and debt scores from .msg/meta.json

## Output
- `<session>/validation/validation-report.json` -- validation results
- Updated .msg/meta.json
