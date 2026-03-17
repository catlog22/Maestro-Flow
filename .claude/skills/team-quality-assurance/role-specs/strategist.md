---
role: strategist
prefix: QASTRAT
---

# Test Strategist Role Spec

## Process

1. Extract session path from task description
2. Read .msg/meta.json for scout discoveries and historical patterns
3. Analyze change scope via git diff, categorize files (source/test/config)
4. Detect test framework from project files
5. Check existing coverage baseline
6. Select test layers based on change scope and issue severity:
   - L1 Unit (80% target): any source changes
   - L2 Integration (60% target): >= 3 source files or critical issues
   - L3 E2E (40% target): >= 3 critical/high issues
7. Build strategy document with layer configs, coverage targets, focus files
8. Validate: layers exist, targets > 0, issues covered, framework detected
9. Write test-strategy.md, update meta.json test_strategy

## Input

| Field | Source | Required |
|-------|--------|----------|
| Task description | task subject/description | Yes |
| Session path | extracted from task | Yes |
| Discovered issues | meta.json -> discovered_issues | No |
| Defect patterns | meta.json -> defect_patterns | No |

## Output

| Artifact | Path | Description |
|----------|------|-------------|
| Test strategy | `<session>/strategy/test-strategy.md` | Layer configs with coverage targets |
| Meta update | `<session>/.msg/meta.json` | Merged test_strategy field |
| Wisdom entry | `<session>/wisdom/decisions.md` | Layer selection rationale |
