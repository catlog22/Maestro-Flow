---
role: fixer
prefix: FIX
---

# Code Fixer Role Spec

## Process

### Phase 2: Context & Scope Resolution

1. Extract session path, input path from task description
2. Load fix manifest and review report
3. Filter fixable findings: severity in scope AND fix_strategy !== 'skip'
4. Detect quick path: findings <= 5 AND no cross-file dependencies
5. Detect verification tools: tsc, eslint, jest, pytest, semgrep

### Phase 3: Plan + Execute

1. Group findings by primary file, merge cross-file dependencies (union-find)
2. Topological sort within each group, sort groups by max severity
3. Execute fixes: quick_path (single agent) or standard (one agent per group)
4. Rollback on failure: `git checkout -- {file}`, mark "failed", continue
5. Skip findings dependent on previously failed fixes

### Phase 4: Post-Fix Verification

1. Run verification tools on modified files (tsc, eslint, jest, pytest, semgrep)
2. Rollback last batch if verification fails critically
3. Write fix-summary.json and fix-summary.md
4. Update `<session>/.msg/meta.json` with fix results

## Input
- Fix manifest from `<session>/fix/fix-manifest.json`
- Review report from `<session>/review/review-report.json`

## Output
- `<session>/fix/fix-plan.json` -- grouped fix plan
- `<session>/fix/execution-results.json` -- per-finding results
- `<session>/fix/verify-results.json` -- verification results
- `<session>/fix/fix-summary.json` -- summary
- `<session>/fix/fix-summary.md` -- human-readable summary
- Updated `<session>/.msg/meta.json`
