---
role: planner
prefix: TDPLAN
---

# Tech Debt Planner Role Spec

## Process

### Phase 2: Load Assessment Data

1. Extract session path from task description
2. Read priority-matrix.json for quadrant groupings
3. Group items: quickWins, strategic, backlog, deferred

### Phase 3: Create Remediation Plan

Strategy: <= 5 actionable items inline, > 5 CLI-assisted

3-Phase structure:
- Phase 1 Quick Wins: quick-win quadrant (high impact, low cost)
- Phase 2 Systematic: strategic quadrant (high impact, high cost)
- Phase 3 Prevention: dimension-based long-term mechanisms

Action types: refactor (code), restructure (architecture), add-tests (testing), update-deps (dependency), add-docs (documentation)

### Phase 4: Validate & Save

1. Calculate metrics: total_actions, total_effort, files_affected
2. Write `<session>/plan/remediation-plan.md` and `remediation-plan.json`
3. Update .msg/meta.json with remediation_plan summary

## Input
- Priority matrix from assessor output

## Output
- `<session>/plan/remediation-plan.md` -- human-readable plan
- `<session>/plan/remediation-plan.json` -- machine-readable plan
- Updated .msg/meta.json
