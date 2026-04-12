---
name: learn-retro-decision
description: Decision trace and evaluation with multi-perspective analysis and lifecycle classification
argument-hint: "[--phase N] [--tag <tag>] [--id <decision-id>]"
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
Decision retrospective that traces architectural and design decisions across wiki, specs, phase contexts, and git history. Evaluates each decision from 3 perspectives (technical soundness, cost assessment, alternative hindsight) and classifies its lifecycle status.

Inspired by gstack's cross-functional review pipeline (CEO/Eng/Design perspectives). Unlike `quality-retrospective` which reviews completed phases holistically, this command focuses specifically on decision quality and evolution.
</purpose>

<context>
Arguments: $ARGUMENTS

**Scope:**
- No arguments → scan all sources for decisions, prompt for selection
- `--phase N` → decisions from phase N's context and related specs
- `--tag <tag>` → decisions tagged with specific tag in wiki/specs
- `--id <id>` → single decision by wiki ID or lessons.jsonl INS-id

**Storage written:**
- `.workflow/learning/retro-decision-{YYYY-MM-DD}.md` — Decision evaluation report
- `.workflow/learning/lessons.jsonl` — Decision evaluation insights (source: "retro-decision")
- `.workflow/learning/learning-index.json` — Updated index

**Storage read:**
- `maestro wiki list --type spec --json` — Spec entries (many contain decisions)
- `maestro wiki search "decision"` — Decision-tagged entries
- `.workflow/specs/architecture-constraints.md` — Documented architectural decisions
- `.workflow/phases/*/context.md` — Phase context with Locked/Free/Deferred decisions (if exists)
- `.workflow/learning/lessons.jsonl` — Entries with `category: "decision"`
- Git log — Implementation evidence for decision tracing
</context>

<execution>

### Stage 1: Collect Decisions
Gather decisions from all sources in parallel:

```bash
# Wiki decisions
maestro wiki search "decision" --json
maestro wiki list --type spec --json  # specs often contain decision entries

# Git evidence
git log --oneline --all --grep="decision\|chose\|decided\|architecture" -20
```

Also read:
- `.workflow/specs/architecture-constraints.md` — grep for `### [decision]` heading blocks
- `.workflow/phases/*/context.md` — scan for "Locked:", "Deferred:" sections
- `.workflow/learning/lessons.jsonl` — filter entries where `category == "decision"`

Apply scope filter (--phase, --tag, --id) to reduce the set.

If no decisions found, AskUserQuestion: "No decisions found in wiki/specs. Would you like to: A) Scan git commit messages for implicit decisions, B) Provide a specific decision to evaluate"

### Stage 2: Build Decision Registry
For each decision, build a structured record:

```json
{
  "id": "decision source id",
  "title": "what was decided",
  "source": "wiki|spec|phase-context|lesson|git",
  "date": "when decided",
  "rationale": "why (if documented)",
  "alternatives": "what was considered (if documented)",
  "phase": "which phase",
  "tags": ["related tags"],
  "implementation_evidence": ["file paths from git that implement this"]
}
```

For implementation evidence: search git log for commits that reference the decision topic, and grep source files for patterns consistent with the decision.

### Stage 3: Multi-Perspective Evaluation
Spawn 3 Agents in a single message, each evaluating all decisions from one perspective:

**Agent 1 — Technical Soundness:**
- Does the implementation match the stated intent?
- Are there code-level violations of the decision?
- Has the technical context changed since the decision was made?
- Grade: sound / degraded / violated

**Agent 2 — Cost Assessment:**
- What complexity did this decision add?
- How many files/modules are affected?
- Is the decision creating coupling or technical debt?
- Grade: low-cost / acceptable / expensive / debt-creating

**Agent 3 — Alternative Hindsight:**
- With what we know now, was this the right call?
- What alternative would we choose today?
- Would reversing this decision be feasible?
- Grade: confirmed / questionable / should-revisit

Each agent receives the full decision registry and returns evaluations per decision.

### Stage 4: Classify Decision Lifecycle
Based on the 3 perspectives, classify each decision:

| Status | Criteria |
|--------|---------|
| **Validated** | Sound + Low/Acceptable cost + Confirmed | 
| **Aging** | Sound but Expensive + Confirmed (still right but costly) |
| **Questionable** | Degraded or Violated + Any cost + Questionable |
| **Stale** | Any soundness + Any cost + Should-revisit |
| **Reversed** | Evidence in code contradicts the decision |

### Stage 5: Generate Recommendations
For each non-Validated decision:
- **Aging**: flag for tech debt review, suggest cost reduction
- **Questionable**: create issue for investigation, suggest brainstorm
- **Stale**: suggest decision refresh (re-evaluate with current context)
- **Reversed**: suggest documenting the reversal and updating specs/wiki

### Stage 6: Write Report
`.workflow/learning/retro-decision-{date}.md`:

```markdown
# Decision Retrospective: {scope}
**Date:** {date} | **Decisions evaluated:** {count}

## Decision Health Dashboard
| Status | Count | Decisions |
|--------|-------|-----------|
| Validated | N | {list} |
| Aging | N | {list} |
| Questionable | N | {list} |
| Stale | N | {list} |

## Per-Decision Evaluation

### {Decision Title}
**Source:** {wiki/spec/phase} | **Date:** {when} | **Status:** {lifecycle}

| Perspective | Grade | Assessment |
|------------|-------|-----------|
| Technical | sound/degraded/violated | {one-line} |
| Cost | low/acceptable/expensive | {one-line} |
| Hindsight | confirmed/questionable/revisit | {one-line} |

**Implementation evidence:** {file references}
**Recommendation:** {action if non-validated}

## Recommended Actions
1. {action}: {reason}
```

### Stage 7: Persist
1. Write report file
2. Append decision evaluation insights to `lessons.jsonl`:
   - `source: "retro-decision"`, `category: "decision"`
   - Tags: `["retro-decision", "{lifecycle-status}"]`
   - One insight per non-Validated decision with the recommendation
3. Update `learning-index.json`
4. Optionally: update wiki entries with evaluation metadata via `maestro wiki update`
5. Display health dashboard summary

**Next-step routing:**
- Create issue for questionable decision → `Skill({ skill: "manage-issue", args: "create ..." })`
- Brainstorm alternatives → `Skill({ skill: "maestro-brainstorm", args: "<decision topic>" })`
- Investigate stale decision → `Skill({ skill: "learn-investigate", args: "<question>" })`
- Update spec → `Skill({ skill: "spec-add", args: "decision <updated rationale>" })`
</execution>

<error_codes>
| Code | Severity | Condition | Recovery |
|------|----------|-----------|----------|
| E001 | error | No decisions found in any source | Check wiki/specs content, or provide --id |
| E002 | error | --id not found in wiki or lessons | Verify the decision ID exists |
| W001 | warning | One perspective agent failed — partial evaluation | Proceed with available perspectives, note gap |
| W002 | warning | No git implementation evidence found for a decision | Decision evaluation is theoretical only |
| W003 | warning | Phase context files not found | Skip phase-context decisions, proceed with wiki/spec sources |
</error_codes>

<success_criteria>
- [ ] Decisions collected from all available sources (wiki, specs, phase-context, lessons, git)
- [ ] Scope filter applied correctly (--phase, --tag, or --id)
- [ ] Decision registry built with structured records
- [ ] 3 perspective agents spawned in parallel
- [ ] Each decision classified: Validated / Aging / Questionable / Stale / Reversed
- [ ] Recommendations generated for non-Validated decisions
- [ ] Report written to `retro-decision-{date}.md` with health dashboard
- [ ] Insights appended to `lessons.jsonl` (source: "retro-decision")
- [ ] `learning-index.json` updated
- [ ] No files modified outside `.workflow/learning/`
- [ ] Health dashboard displayed with next-step routing
</success_criteria>
