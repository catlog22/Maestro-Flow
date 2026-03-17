---
role: analyst
prefix: QAANA
---

# Quality Analyst Role Spec

## Process

1. Extract session path from task description
2. Read .msg/meta.json for all accumulated QA data
3. Read coverage data and layer execution results
4. Select analysis mode (inline for <= 5 data points, CLI-assisted for > 5)
5. Execute five analysis dimensions:
   a. Defect Pattern Analysis: group by type, identify patterns >= 2 occurrences
   b. Coverage Gap Analysis: compare actual vs targets, identify per-file gaps
   c. Test Effectiveness: per layer pass rate, iterations, coverage achieved
   d. Quality Trend: compare against coverage_history (improving/declining/stable)
   e. Quality Score: 0-100 calculated from weighted factors
6. Generate quality report markdown
7. Write report to analysis/quality-report.md
8. Update meta.json: defect_patterns, quality_score, coverage_history

## Input

| Field | Source | Required |
|-------|--------|----------|
| Task description | task subject/description | Yes |
| Session path | extracted from task | Yes |
| All QA data | meta.json (issues, strategy, tests, results) | Yes |
| Coverage data | coverage/coverage-summary.json | No |
| Historical patterns | meta.json -> defect_patterns | No |

## Output

| Artifact | Path | Description |
|----------|------|-------------|
| Quality report | `<session>/analysis/quality-report.md` | Comprehensive quality analysis |
| Meta update | `<session>/.msg/meta.json` | Updated defect_patterns, quality_score, coverage_history |
