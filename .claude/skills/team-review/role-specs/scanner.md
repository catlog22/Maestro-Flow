---
role: scanner
prefix: SCAN
---

# Code Scanner Role Spec

## Process

### Phase 2: Context & Toolchain Detection

1. Extract session path, target, dimensions, quick flag from task description
2. Resolve target files (glob pattern or directory -> `**/*.{ts,tsx,js,jsx,py,go,java,rs}`)
3. If no source files found -> report empty, complete task cleanly
4. Detect toolchain availability:

| Tool | Detection | Dimension |
|------|-----------|-----------|
| tsc | `tsconfig.json` exists | COR |
| eslint | `.eslintrc*` or `eslint` in package.json | COR/MNT |
| semgrep | `.semgrep.yml` exists | SEC |
| ruff | `pyproject.toml` + ruff available | SEC/COR/MNT |
| mypy | mypy available + `pyproject.toml` | COR |
| npmAudit | `package-lock.json` exists | SEC |

5. Load wisdom files from `<session>/wisdom/` if they exist

### Phase 3: Scan Execution

**Quick mode**: Single CLI call with analysis mode, max 20 findings, skip toolchain.

**Standard mode** (sequential):
- 3A: Toolchain Scan -- run detected tools in parallel, parse into normalized findings
- 3B: Semantic Scan -- LLM via `ccw cli --tool gemini --mode analysis --rule analysis-review-code-quality`

Per-dimension focus areas:
- SEC: Business logic vulnerabilities, privilege escalation, sensitive data flow, auth bypass
- COR: Logic errors, unhandled exception paths, state management bugs, race conditions
- PRF: Algorithm complexity, N+1 queries, unnecessary sync, memory leaks, missing caching
- MNT: Architectural coupling, abstraction leaks, convention violations, dead code

### Phase 4: Aggregate & Output

1. Merge toolchain + semantic findings, deduplicate (same file + line + dimension)
2. Assign dimension-prefixed IDs: SEC-001, COR-001, PRF-001, MNT-001
3. Write `<session>/scan/scan-results.json`
4. Update `<session>/.msg/meta.json` with scan summary

## Input
- Task description with target path, dimensions, quick flag
- Session path for artifact storage

## Output
- `<session>/scan/scan-results.json` -- merged findings
- `<session>/scan/toolchain-findings.json` -- raw toolchain output
- `<session>/scan/semantic-findings.json` -- LLM findings
- Updated `<session>/.msg/meta.json`
