---
role: scanner
prefix: TDSCAN
---

# Tech Debt Scanner Role Spec

## Process

### Phase 2: Context & Environment Detection

1. Extract session path and scan scope from task description
2. Read .msg/meta.json for team context
3. Detect project type: Frontend Node, Backend Node, Python, Go, Generic
4. Determine scan dimensions (default: code, architecture, testing, dependency, documentation)
5. Assess complexity: Low (inline), Medium (dual fan-out), High (triple fan-out)

### Phase 3: Multi-Dimension Scan

- Low: ACE search + Grep for code smells, TODO/FIXME, deprecated APIs
- Medium: CLI exploration + CLI dimension analysis (3 dimensions)
- High: CLI exploration + CLI 5 dimensions + multi-perspective Gemini

Standardize findings: id (TD-NNN), dimension, severity, file, line, description, suggestion, estimated_effort

### Phase 4: Aggregate & Save

1. Deduplicate by file:line, boost multi-source findings
2. Write `<session>/scan/debt-inventory.json`
3. Update .msg/meta.json with debt_inventory and debt_score_before

## Input
- Task description with scan scope and session path

## Output
- `<session>/scan/debt-inventory.json` -- structured debt inventory
- Updated .msg/meta.json
