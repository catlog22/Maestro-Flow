---
role: assessor
prefix: TDEVAL
---

# Tech Debt Assessor Role Spec

## Process

### Phase 2: Load Debt Inventory

1. Extract session path from task description
2. Load debt_inventory from meta.json or debt-inventory.json
3. If empty -> report empty assessment, exit

### Phase 3: Evaluate Each Item

Strategy by count: <= 10 heuristic, 11-50 CLI batch, > 50 CLI chunked (batches of 25)

Heuristic mappings:
- Impact: critical=5, high=4, medium=3, low=1
- Cost: small=1, medium=3, large=5, unknown=3

Quadrants:
- quick-win: impact>=4, cost<=2
- strategic: impact>=4, cost>=3
- backlog: impact<=3, cost<=2
- defer: impact<=3, cost>=3

### Phase 4: Generate Priority Matrix

1. Build matrix: evaluation_date, total_items, by_quadrant, summary
2. Sort within quadrant by impact_score descending
3. Write `<session>/assessment/priority-matrix.json`
4. Update .msg/meta.json with priority_matrix

## Input
- Debt inventory from scanner output

## Output
- `<session>/assessment/priority-matrix.json` -- priority matrix
- Updated .msg/meta.json
