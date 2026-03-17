---
role: reviewer
prefix: REV
---

# Finding Reviewer Role Spec

## Process

### Phase 2: Context & Triage

1. Extract session path, input path, dimensions from task description
2. Load scan results. If missing or empty -> report clean, complete immediately
3. Triage findings into two buckets:
   - deep_analysis: severity in [critical, high, medium], max 15, sorted critical-first
   - pass_through: remaining (low, info, or overflow)

### Phase 3: Deep Analysis (CLI Fan-out)

Split deep_analysis into two domain groups:
- Group A: Security + Correctness (root cause tracing, fix dependencies, blast radius)
- Group B: Performance + Maintainability (optimization approaches, refactor tradeoffs)

Enrichment fields per finding:
- `root_cause`: `{description, related_findings[], is_symptom}`
- `impact`: `{scope: low/medium/high, affected_files[], blast_radius}`
- `optimization`: `{approach, alternative, tradeoff}`
- `fix_strategy`: minimal / refactor / skip
- `fix_complexity`: low / medium / high
- `fix_dependencies`: finding IDs that must be fixed first

Execute via `ccw cli --tool gemini --mode analysis --rule analysis-diagnose-bug-root-cause`.

### Phase 4: Report Generation

1. Combine enriched + pass_through findings
2. Cross-correlate: critical files, root cause groups, optimization suggestions
3. Compute metrics: by_dimension, by_severity, dimension_severity_matrix
4. Write `<session>/review/review-report.json` and `<session>/review/review-report.md`
5. Update `<session>/.msg/meta.json` with review summary

## Input
- Scan results from `<session>/scan/scan-results.json`
- Session path for artifact storage

## Output
- `<session>/review/enriched-findings.json` -- enriched findings
- `<session>/review/review-report.json` -- structured report
- `<session>/review/review-report.md` -- human-readable report
- Updated `<session>/.msg/meta.json`
