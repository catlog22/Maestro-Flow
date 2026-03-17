# Debug Workflow

Debug issues using scientific method with subagent isolation. Supports three modes:

1. **Standalone**: User describes issue, gather symptoms via 5 questions
2. **From UAT**: --from-uat reads uat.md gaps as pre-filled symptoms (skip gathering)
3. **Parallel**: --parallel spawns one debug agent per gap cluster concurrently

Output: understanding.md + evidence.ndjson per investigation.
When root causes found, auto-updates originating uat.md with diagnosis.

---

### Step 1: Check Active Sessions

```bash
# Phase-scoped debug sessions
find .workflow/phases -path "*/.debug/*" -name "understanding.md" 2>/dev/null | head -5

# Standalone scratch debug sessions
find .workflow/scratch -type d -name "debug-*" 2>/dev/null | head -5
```

**If active sessions exist AND no $ARGUMENTS:**

Read each session's understanding.md header for status and current hypothesis.

Display:
```
## Active Debug Sessions

| # | Location | Status | Current Hypothesis |
|---|----------|--------|--------------------|
| 1 | phases/03-auth/.debug/jwt-expiry/ | investigating | Token not refreshed on 401 |
| 2 | scratch/debug-nav-crash-2026-03-14/ | checkpoint | Awaiting user input |

Reply with a number to resume, or describe a new issue.
```

Wait for user response.
- Number -> resume that session (load state, go to Step 11: Spawn Continuation)
- Text -> treat as new issue (go to Step 3 or Step 2)

| Result | Action |
|--------|--------|
| Active session found, no args | Offer resume list |
| Active session found, args given | Start new investigation |
| No active sessions, no args | Error E001 |
| No active sessions, args given | Continue to appropriate mode |

If resuming: load understanding.md + evidence.ndjson, spawn continuation agent.

---

### Step 1.5: Load Project Specs

```
specs_content = maestro spec load --category debug
```

Pass to debug agents as prior knowledge (known issues, root causes, workarounds).

---

### Step 2: Load UAT Gaps (if --from-uat)

Skip if --from-uat is not set. Go to Step 3 instead.

Read `{phase_dir}/uat.md` Gaps section. For each gap:
```yaml
- test: T-003
  truth: "User can reply to comments"
  status: failed
  reason: "User reported: clicking reply does nothing"
  severity: major
  requirement_ref: SC-002
```

**Cluster gaps by component/area:**
- Parse affected features from truth + reason
- Group by likely component (same module, same flow, same file area)
- Each cluster becomes one debug investigation

| Clustering | Example |
|-----------|---------|
| Same component | T-003 (reply) + T-004 (edit comment) -> "comment-actions" cluster |
| Same flow | T-001 (login) + T-002 (session) -> "auth-flow" cluster |
| Unrelated | T-005 (nav color) -> standalone "nav-styling" cluster |

**Extract issue references for context enrichment:**
```
IF file exists ".workflow/issues/issues.jsonl":
  issues = read_ndjson(".workflow/issues/issues.jsonl")
  FOR each gap in loaded gaps:
    IF gap has issue_id field:
      matched_issue = issues.find(i => i.id == gap.issue_id)
      IF matched_issue:
        gap.issue_context = {
          severity: matched_issue.severity,
          feedback: matched_issue.feedback,
          fix_direction: matched_issue.fix_direction,
          context: matched_issue.context
        }
  // Pass issue_context to debug agent prompts for richer diagnosis
```

If --parallel is set: go to Step 5: Spawn Parallel Debuggers.
If --parallel is not set: investigate clusters sequentially (Step 6: Spawn Single Debugger per cluster).

---

### Step 3: Gather Symptoms (standalone mode only)

Skip if --from-uat is set.

Generate a slug from issue description (lowercase, hyphens, max 40 chars).

Ask 5 questions via AskUserQuestion:
1. "What should happen? (expected behavior)"
2. "What happens instead? (actual behavior)"
3. "Any error messages? Paste them or describe."
4. "When did this start? Did it ever work?"
5. "How do you trigger this? (reproduction steps)"

Also gather automated context:
```bash
git log --oneline -10 2>/dev/null
git diff --stat HEAD~3 2>/dev/null
```

Store all responses. Confirm: "Symptoms gathered. Starting investigation..."
Create debug session directory and proceed to Step 6.

---

### Step 4: Determine Output Directory

| Mode | Directory |
|------|-----------|
| Phase-scoped (from UAT) | `.workflow/phases/{NN}-{slug}/.debug/{gap-slug}/` |
| Standalone | `.workflow/scratch/debug-{slug}-{date}/` |

```bash
mkdir -p "$DEBUG_DIR"
```

---

### Step 5: Spawn Parallel Debug Agents

For each cluster, spawn concurrently:

```
Agent({
  subagent_type: "general-purpose",
  description: "Debug cluster: {cluster_name}",
  prompt: "
    <objective>
    Investigate UAT failures in cluster '{cluster_name}' for phase {phase}.
    </objective>

    <symptoms>
    Mode: symptoms_prefilled (do NOT ask user questions)

    Gaps in this cluster:
    {for each gap in cluster:}
      Test: {test_id}
      Expected: {truth}
      Actual: {reason}
      Severity: {severity}
    {end for}
    </symptoms>

    <instructions>
    1. Read relevant source files for the affected functionality
    2. Form 2-3 hypotheses per gap, ranked by likelihood
    3. For each hypothesis:
       a. Search code for evidence (grep, read files)
       b. Log evidence as NDJSON line
       c. Confirm or refute
    4. Return structured results:

    ## CLUSTER DIAGNOSIS: {cluster_name}

    ### Gap: {test_id}
    - root_cause: {what's wrong}
    - fix_direction: {how to fix}
    - affected_files: [{file:line}, ...]
    - confidence: high|medium|low
    - evidence: {key evidence summary}

    ### Gap: {test_id}
    ...

    Write evidence to: {debug_dir}/evidence-{cluster_slug}.ndjson
    Write understanding to: {debug_dir}/understanding-{cluster_slug}.md
    </instructions>
  ",
  run_in_background: false
})
```

All agents run concurrently. Collect all results.

---

### Step 6: Spawn Single Debug Agent (sequential mode)

Build prompt with symptoms (gathered or pre-filled):

```
Agent({
  subagent_type: "general-purpose",
  description: "Debug: {issue_slug}",
  prompt: "
    <objective>
    Investigate issue: {slug}
    Summary: {issue description}
    </objective>

    <symptoms>
    expected: {expected behavior}
    actual: {actual behavior}
    errors: {error messages}
    reproduction: {reproduction steps}
    timeline: {timeline}
    </symptoms>

    <mode>
    symptoms_prefilled: {true if from UAT, false if gathered}
    goal: find_and_fix
    </mode>

    <output_dir>{$DEBUG_DIR}</output_dir>

    <instructions>
    1. Form initial hypotheses (rank by likelihood)
    2. For each hypothesis (most likely first):
       a. Design a specific test
       b. Execute the test
       c. Log evidence as NDJSON line to evidence.ndjson
       d. Update understanding.md
    3. Return ONE of:
       - '## ROOT CAUSE FOUND' + root cause + evidence + fix recommendation
       - '## CHECKPOINT REACHED' + what you need from user
       - '## INVESTIGATION INCONCLUSIVE' + what was checked + eliminated

    Create files:
    - {$DEBUG_DIR}/understanding.md
    - {$DEBUG_DIR}/evidence.ndjson
    </instructions>
  ",
  run_in_background: false
})
```

Handle result based on agent output type.

---

### Step 7: Collect and Unify Results

For each agent result, extract:
- root_cause per gap
- fix_direction per gap
- affected_files per gap
- confidence level
- evidence summary

Build unified diagnosis:
```json
{
  "session_id": "{debug session ID}",
  "completed_at": "{ISO timestamp}",
  "clusters": [
    {
      "name": "{cluster_name}",
      "gaps": [
        {
          "test_id": "T-003",
          "root_cause": "...",
          "fix_direction": "...",
          "affected_files": ["src/components/Comments.tsx:42"],
          "confidence": "high"
        }
      ]
    }
  ]
}
```

### Step 7.1: Update Issues with Diagnosis

```
IF file exists ".workflow/issues/issues.jsonl":
  FOR each diagnosis result across all clusters:
    FOR each gap in diagnosis.gaps:
      IF gap has issue_id (from issue_context passed in Step 2):
        Update issue in .workflow/issues/issues.jsonl:
          status: "diagnosed"
          context.suggested_fix: gap.fix_direction
          context.notes: gap.root_cause
          updated_at: now()
        Append to issue.issue_history:
          { from: previous_status, to: "diagnosed", changed_at: now(), actor: "debug-agent" }

  Display: "Updated {count} issues with diagnosis results"
```

---

### Step 8: Update UAT (if --from-uat)

Skip if standalone mode.

For each diagnosed gap, update the uat.md Gaps section:
```yaml
- test: T-003
  truth: "User can reply to comments"
  status: failed
  reason: "User reported: clicking reply does nothing"
  severity: major
  root_cause: "Reply handler not wired to API endpoint"
  fix_direction: "Connect onReply to POST /api/comments/{id}/reply"
  affected_files: ["src/components/Comments.tsx:42", "src/api/comments.ts:78"]
```

This closes the UAT -> debug feedback loop.

---

### Step 9: Handle Root Cause Found

Display root cause, evidence, and fix recommendation.

```
------------------------------------------------------------
  ROOT CAUSE IDENTIFIED
------------------------------------------------------------

{root cause description}

Evidence:
{key evidence points with file:line references}

Recommended fix:
{fix recommendation}

------------------------------------------------------------
Options:
1. Fix now -- Skill({ skill: "maestro-quick", args: "apply fix" })
2. Plan fix -- Skill({ skill: "maestro-plan", args: "{phase} --gaps" })
3. Manual fix -- investigate/fix yourself
------------------------------------------------------------
```

---

### Step 10: Handle Checkpoint

Parse checkpoint type and details. Present to user via AskUserQuestion.
If user provides input: spawn continuation agent with prior state + user response.
If user wants to pause: save state, exit.

---

### Step 11: Handle Inconclusive

Display what was checked and eliminated. Offer:
1. Continue investigating (fresh agent with prior state)
2. Add more context (gather additional symptoms)
3. Manual investigation (pause session)

---

### Step 12: Spawn Continuation Agent

Load prior state (understanding.md + evidence.ndjson).
Build continuation prompt with user's checkpoint response.
Handle return the same way (root cause / checkpoint / inconclusive).

---

### Step 13: Report

```
=== DEBUG SESSION ===
Mode:        {standalone | from-uat | parallel}
Target:      {issue or phase}

Clusters:    {cluster_count} investigated
Gaps:        {total_gaps} total
  Diagnosed: {diagnosed_count} root causes found
  Uncertain: {uncertain_count} need more investigation

Files:
  {debug_dir}/understanding.md (or understanding-{cluster}.md per cluster)
  {debug_dir}/evidence.ndjson (or evidence-{cluster}.ndjson per cluster)

UAT Updated: {yes/no} ({uat_path} if yes)

Next steps:
  {suggested_next_command}
```

**Next step routing:**

| Result | Suggestion |
|--------|------------|
| All root causes found | Skill({ skill: "maestro-quick", args: "apply fixes" }) or Skill({ skill: "maestro-plan", args: "--gaps" }) |
| Some inconclusive | Resume with more context or manual investigation |
| From UAT, all diagnosed | Skill({ skill: "quality-test", args: "{phase} --auto-fix" }) to trigger gap-fix loop |

---

## Evidence Format

**evidence.ndjson -- one JSON object per line:**

```json
{"timestamp":"2026-03-14T10:30:00+08:00","hypothesis":"JWT token not refreshed on 401","action":"grep for 401 handler","result":"Found handler but no refresh call","conclusion":"confirmed"}
```

Each line is a self-contained investigation step. Append-only.

---

## Understanding Template

```markdown
# Debug: {issue slug}

## Status
{investigating | checkpoint | resolved | inconclusive}

## Issue
{original issue description}

## Symptoms
- Expected: {expected}
- Actual: {actual}
- Errors: {errors}
- Timeline: {timeline}
- Reproduction: {steps}

## Hypotheses

### H1: {hypothesis} [CONFIRMED/REFUTED/TESTING]
Evidence: {summary of evidence}

### H2: {hypothesis} [CONFIRMED/REFUTED/TESTING]
Evidence: {summary}

## Root Cause
{filled when found}

## Fix
{filled when determined}
```
