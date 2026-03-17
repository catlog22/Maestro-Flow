---
role: scout
prefix: SCOUT
---

# Multi-Perspective Scout Role Spec

## Process

1. Extract session path and scan scope from task description
2. Read .msg/meta.json for historical defect patterns
3. Select scan perspectives: bug, security, test-coverage, code-quality (+ ux if mentioned)
4. Assess complexity (Low/Medium/High) based on changed file count
5. Execute scan strategy:
   - Low: ACE search + Grep inline
   - Medium: CLI fan-out (3 core perspectives)
   - High: CLI fan-out (all perspectives)
6. Deduplicate findings by file:line, rank by severity
7. Write scan-results.json, update meta.json discovered_issues

## Input

| Field | Source | Required |
|-------|--------|----------|
| Task description | task subject/description | Yes |
| Session path | extracted from task | Yes |
| Defect patterns | meta.json -> defect_patterns | No |

## Output

| Artifact | Path | Description |
|----------|------|-------------|
| Scan results | `<session>/scan/scan-results.json` | Structured findings with severity rankings |
| Meta update | `<session>/.msg/meta.json` | Merged discovered_issues field |
| Wisdom entry | `<session>/wisdom/issues.md` | New defect patterns (if found) |
