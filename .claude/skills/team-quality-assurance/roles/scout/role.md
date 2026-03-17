---
role: scout
prefix: SCOUT
inner_loop: false
message_types: {success: scan_ready, error: error, issues: issues_found}
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep]
---

# Multi-Perspective Scout

## Role
Scan codebase from multiple perspectives (bug, security, test-coverage, code-quality, UX) to discover potential issues. Produce structured scan results with severity-ranked findings.

## Process

### Step 1: Context and Scope Assessment

| Input | Source | Required |
|-------|--------|----------|
| Task description | From task subject/description | Yes |
| Session path | Extracted from task description | Yes |
| .msg/meta.json | <session>/.msg/meta.json | No |

1. Extract session path and target scope from task description
2. Determine scan scope: explicit scope from task or `**/*` default
3. Get recent changed files: `git diff --name-only HEAD~5 2>/dev/null || echo ""`
4. Read .msg/meta.json for historical defect patterns (`defect_patterns`)
5. Select scan perspectives based on task description:
   - Default: `["bug", "security", "test-coverage", "code-quality"]`
   - Add `"ux"` if task mentions UX/UI
6. Assess complexity to determine scan strategy:

| Complexity | Condition | Strategy |
|------------|-----------|----------|
| Low | < 5 changed files, no specific keywords | ACE search + Grep inline |
| Medium | 5-15 files or specific perspective requested | CLI fan-out (3 core perspectives) |
| High | > 15 files or full-project scan | CLI fan-out (all perspectives) |

### Step 2: Multi-Perspective Scan

**Low complexity**: Use `mcp__ace-tool__search_context` for quick pattern-based scan.

**Medium/High complexity**: CLI fan-out -- one `ccw cli --mode analysis` per perspective:

For each active perspective, build prompt:
```
PURPOSE: Scan code from <perspective> perspective to discover potential issues
TASK: Analyze code patterns for <perspective> problems, identify anti-patterns, check for common issues
MODE: analysis
CONTEXT: @<scan-scope>
EXPECTED: List of findings with severity (critical/high/medium/low), file:line references, description
CONSTRAINTS: Focus on actionable findings only
```
Execute via: `ccw cli -p "<prompt>" --tool gemini --mode analysis`

**Perspective Focus Areas**:

| Perspective | Focus |
|-------------|-------|
| bug | Logic errors, crash paths, null references, race conditions |
| security | Vulnerabilities, auth bypass, data exposure, injection flaws |
| test-coverage | Untested code paths, missing assertions, dead branches |
| code-quality | Anti-patterns, complexity, maintainability, naming issues |
| ux | User-facing issues, accessibility, error messaging (optional) |

After all perspectives complete:
- Parse CLI outputs into structured findings
- Deduplicate by file:line (merge perspectives for same location)
- Compare against known defect patterns from .msg/meta.json
- Rank by severity: critical > high > medium > low

### Step 3: Result Aggregation

1. Build `discoveredIssues` array from critical + high findings (with id, severity, perspective, file, line, description)
2. Write scan results to `<session>/scan/scan-results.json`:
   - scan_date, perspectives scanned, total findings, by_severity counts, findings detail, issues_created count
3. Update `<session>/.msg/meta.json`: merge `discovered_issues` field
4. Contribute to wisdom/issues.md if new patterns found

## Input
- Task description with target scope
- Session path for artifact storage
- Historical defect patterns from meta.json (optional)

## Output
- `<session>/scan/scan-results.json` with structured findings
- Updated `discovered_issues` in meta.json
- wisdom/issues.md entries for new patterns

## Constraints
- Read-only scanning -- do not modify any source or test files
- All findings must include file:line references
- Severity ranking must be consistent across perspectives
- Maximum 5 CLI fan-out calls (one per perspective)
- All output lines prefixed with `[scout]` tag

## Error Handling

| Error | Resolution |
|-------|------------|
| No files in scope | Report empty scan, return scan_ready with 0 findings |
| CLI perspective fails | Continue with remaining perspectives, log warning |
| ACE search unavailable | Fall back to Grep-based scanning |
| No issues found | Report clean scan, proceed with scan_ready message |
