---
name: learn-retro-git
description: Git activity retrospective with metrics, session detection, per-author breakdown, and trend tracking
argument-hint: "[--days N] [--author <name>] [--area <path>] [--compare]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Agent
  - AskUserQuestion
---
<purpose>
Git-activity retrospective that works on raw git history regardless of workflow phase state. Complements `quality-retrospective` (which requires completed phase artifacts) by analyzing commit metrics, detecting work sessions, computing test ratios, and tracking trends over time.

Inspired by gstack `/retro`: per-author breakdown, session clustering, LOC metrics, file hotspot detection, and comparison against prior retrospectives.

All insights are persisted to `.workflow/learning/lessons.jsonl` (source: "git-retro") so they're queryable via `manage-learn search/list`.
</purpose>

<context>
Arguments: $ARGUMENTS

**Flags:**
- `--days N` — Time window in days (default: 7)
- `--author <name>` — Filter commits by author name (substring match)
- `--area <path>` — Scope to files under a specific directory
- `--compare` — Compare against the previous retro-git report if one exists

**Storage written:**
- `.workflow/learning/retro-git-{YYYY-MM-DD}.json` — Structured metrics (machine-readable)
- `.workflow/learning/retro-git-{YYYY-MM-DD}.md` — Human-readable retrospective report
- `.workflow/learning/lessons.jsonl` — Appended insights (source: "git-retro")
- `.workflow/learning/learning-index.json` — Updated index

**Storage read:**
- `.workflow/state.json` — Current phase context (optional)
- `.workflow/learning/retro-git-*.json` — Prior retro for trend comparison
- `.workflow/learning/lessons.jsonl` — Existing insights for dedup
</context>

<execution>

### Stage 1: Parse Arguments
- Resolve date range: `--days N` or default 7. Compute absolute start date at midnight.
- Extract `--author`, `--area`, `--compare` flags.
- Check `.workflow/learning/` exists; bootstrap if missing.

### Stage 2: Gather Raw Data (parallel git commands)
Run ALL these git commands in parallel (they are independent):

```bash
# 1. Commit stats with author, timestamp, subject, files changed
git log --since="<start-date>T00:00:00" --format="%H|%aN|%ae|%ai|%s" --shortstat

# 2. Per-commit numstat for test vs production LOC split
# Test files: match test/|spec/|__tests__/|*.test.*|*.spec.*
git log --since="<start-date>T00:00:00" --format="COMMIT:%H|%aN" --numstat

# 3. Timestamps for session detection (sorted)
git log --since="<start-date>T00:00:00" --format="%at|%aN|%ai|%s" | sort -n

# 4. File hotspots (most frequently changed files)
git log --since="<start-date>T00:00:00" --format="" --name-only | grep -v '^$' | sort | uniq -c | sort -rn | head -20

# 5. Per-author commit counts
git shortlog --since="<start-date>T00:00:00" -sn --no-merges

# 6. Per-author file hotspots
git log --since="<start-date>T00:00:00" --format="AUTHOR:%aN" --name-only
```

Apply `--author` filter and `--area` path filter to all commands if provided.

### Stage 3: Compute Metrics
Calculate and build a metrics object:

| Metric | Computation |
|--------|-------------|
| Commits | Count of non-merge commits |
| Contributors | Unique author count |
| Total insertions / deletions | Sum from shortstat |
| Net LOC | insertions - deletions |
| Test LOC (insertions) | Sum insertions for test files from numstat |
| Test ratio | test_insertions / total_insertions × 100% |
| Churn rate | Files changed >2 times / total unique files |
| Active days | Distinct dates with commits |
| Area concentration | Top directory % of total commits (Herfindahl) |

### Stage 4: Detect Work Sessions
Cluster commits by >2hr gaps in timestamps:
- Group consecutive commits within 2-hour windows into sessions
- Per session: start time, end time, duration, commit count, primary focus area (most-touched directory)
- Compute: total sessions, avg session duration, avg LOC/session-hour

### Stage 5: Per-Author Breakdown
For each author:
- Commit count, LOC added/removed, top 3 file areas
- Test ratio (their test LOC / their total LOC)
- Session count and patterns

### Stage 6: Trend Comparison (if --compare or prior report exists)
- Find most recent `.workflow/learning/retro-git-*.json`
- If found, compute deltas: commits Δ, LOC Δ, test ratio Δ, churn rate Δ, session count Δ
- Flag significant changes (>20% delta) as trend highlights

### Stage 7: Distill Insights
Identify actionable insights from metrics:
- **High churn files** (changed >3 times): instability signal → suggest refactor or test coverage
- **Low test ratio areas** (<20%): testing gap → suggest test generation
- **Session patterns**: scattered sessions (many short) vs deep sessions (few long)
- **Area drift**: if commits don't align with current roadmap phase

Each insight: title, description, category (pattern/antipattern/technique), tags, confidence.

### Stage 8: Persist & Report
1. Write `.workflow/learning/retro-git-{date}.json` with full metrics structure
2. Write `.workflow/learning/retro-git-{date}.md` with formatted report:
   - Summary metrics table
   - Per-author leaderboard
   - Session timeline
   - File hotspots
   - Insights with recommendations
   - Trend deltas (if comparing)
3. Append each insight to `lessons.jsonl` with `source: "git-retro"`, `lens: null`, using stable INS-id from `hash(metric_name + date)`
4. Update `learning-index.json`
5. Display summary and next-step suggestions

**Next-step routing:**
- Browse insights → `Skill({ skill: "manage-learn", args: "list --tag git-retro" })`
- Deep dive on high-churn file → `Skill({ skill: "learn-follow", args: "<path>" })`
- Fix test gaps → `Skill({ skill: "quality-test-gen", args: "<area>" })`
</execution>

<error_codes>
| Code | Severity | Condition | Recovery |
|------|----------|-----------|----------|
| E001 | error | Not inside a git repository | Navigate to a git repo directory |
| E002 | error | No commits found in the specified time window | Increase --days or check --author/--area filters |
| W001 | warning | `.workflow/learning/` not found, bootstrapping | Auto-created; proceed normally |
| W002 | warning | No prior retro-git report for comparison | Skip trend section; first retro establishes baseline |
| W003 | warning | Author filter matched 0 commits | Show available authors and re-prompt |
</error_codes>

<success_criteria>
- [ ] Date range parsed correctly (absolute midnight-aligned start date)
- [ ] All 6 git commands executed successfully
- [ ] Metrics computed: commits, LOC, test ratio, churn rate, sessions, area concentration
- [ ] Sessions detected with >2hr gap clustering
- [ ] Per-author breakdown generated for all contributors
- [ ] Trend comparison computed if prior report exists and --compare used
- [ ] At least 1 actionable insight distilled from metrics
- [ ] `retro-git-{date}.json` written with valid JSON
- [ ] `retro-git-{date}.md` written and human-readable
- [ ] `lessons.jsonl` appended with insights (source: "git-retro", stable INS-ids)
- [ ] `learning-index.json` updated
- [ ] No files modified outside `.workflow/learning/`
- [ ] Summary displayed with next-step routing
</success_criteria>
