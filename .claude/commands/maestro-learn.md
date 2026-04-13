---
name: maestro-learn
description: Learning coordinator - analyze intent → route to optimal learn command chain → execute via Skill()
argument-hint: "\"intent text\" [-y] [--dry-run] [--chain <name>]"
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
Orchestrate all learn-* commands based on user intent. Routes natural language learning requests to the optimal learn command or multi-step chain.

Two routing modes:
1. **Intent-based**: User describes a learning goal → classify → select command/chain → confirm → execute
2. **Direct**: User specifies a known chain name via `--chain`

Produces session directory at `.workflow/learning/.maestro-learn/{session_id}/` with status.json tracking chain progress.
Executes commands sequentially via Skill() with artifact propagation between steps.
</purpose>

<context>
$ARGUMENTS — user learning intent text, or flags.

**Flags:**
- `-y` / `--yes` — Auto mode: skip clarification, skip confirmation
- `--dry-run` — Show planned chain without executing
- `--chain <name>` — Force a specific chain (bypass intent detection). Valid: `follow`, `investigate`, `decompose`, `second-opinion`, `retro-git`, `retro-decision`, `deep-understand`, `pattern-catalog`, `full-retro`

**Available learn commands:**
| Command | Purpose |
|---------|---------|
| `learn-follow` | Guided reading with forcing questions, pattern extraction |
| `learn-investigate` | Hypothesis-driven question investigation |
| `learn-decompose` | 4-dimension parallel pattern extraction |
| `learn-second-opinion` | Multi-perspective review/challenge/consult |
| `learn-retro-git` | Git activity retrospective with metrics |
| `learn-retro-decision` | Decision trace and lifecycle evaluation |

**Storage:**
- `.workflow/learning/.maestro-learn/{session_id}/status.json` — Session tracking
- All learn command outputs go to `.workflow/learning/`
</context>

<execution>

### Step 1: Parse Arguments & Detect Mode

```javascript
const autoYes = /\b(-y|--yes)\b/.test($ARGUMENTS)
const dryRun = /\b--dry-run\b/.test($ARGUMENTS)
const forcedChain = $ARGUMENTS.match(/--chain\s+(\S+)/)?.[1] || null
const intent = $ARGUMENTS
  .replace(/\b(-y|--yes|--dry-run)\b/g, '')
  .replace(/--chain\s+\S+/g, '')
  .trim()
```

**Display banner:**
```
============================================================
  MAESTRO LEARN COORDINATOR
============================================================
  Mode:  {intent-based | forced-chain}
  Auto:  {yes | no}
  Input: {intent}
```

---

### Step 2: Analyze Intent

**If `$FORCED_CHAIN` is set:**
- Validate against known chains: `follow`, `investigate`, `decompose`, `second-opinion`, `retro-git`, `retro-decision`, `deep-understand`, `pattern-catalog`, `full-retro`
- If valid: skip intent analysis, jump to **Step 4**
- If invalid: **Error E005** — display valid chains

**Extract structured intent:**

```json
{
  "action":  "<from enum>",
  "target":  "<file path | module | topic | wiki-id | null>",
  "mode":    "<review | challenge | consult | null>",
  "scope":   "<path filter | null>",
  "flags":   "<--depth, --days, --save-wiki, etc.>"
}
```

**Action enum:**

| action | Triggered by (semantic) |
|--------|------------------------|
| `read` | Read code, follow along, walk through, understand file, 阅读, 跟读 |
| `question` | Why does X, how does Y work, what happens if, investigate, 为什么, 怎么 |
| `patterns` | Find patterns, decompose, catalog, extract conventions, 分解, 模式 |
| `opinion` | Second opinion, review, challenge, critique, consult, 评审, 挑战 |
| `retro-git` | Git activity, commit history, retro, work sessions, 提交回顾 |
| `retro-decision` | Decision review, architecture decisions, decision quality, 决策回顾 |
| `learn` | Generic learn, capture insight, remember — route to best fit |

**Target resolution:**
- Contains `/` or `\` or file extension → file path
- Matches `<type>-<slug>` → wiki ID
- Matches `--days`, `--author` → retro-git flags
- Matches `--phase`, `--tag`, `--id` → retro-decision flags
- Otherwise → topic string (passed as quoted argument)

---

### Step 3: Route via action → command

```javascript
const routeMap = {
  'read':           'follow',
  'question':       'investigate',
  'patterns':       'decompose',
  'opinion':        'second-opinion',
  'retro-git':      'retro-git',
  'retro-decision': 'retro-decision',
  'learn':          null,  // needs disambiguation
};

function routeLearnIntent(action, target, intent) {
  // Direct mapping
  if (routeMap[action]) return routeMap[action];

  // Disambiguate generic 'learn' based on target and context
  if (target && isFilePath(target))  return 'follow';
  if (target && isWikiId(target))    return 'follow';
  if (/retro|commit|git|session/i.test(intent))  return 'retro-git';
  if (/decision|architect/i.test(intent))         return 'retro-decision';
  if (/pattern|decompose|catalog/i.test(intent))  return 'decompose';
  if (/opinion|review|challenge/i.test(intent))   return 'second-opinion';
  if (/why|how|what if/i.test(intent))            return 'investigate';

  // Fallback: ask user
  return null;
}
```

**Compute clarity score:**
- 3: `action` recognized + `target` present + specific flags
- 2: `action` recognized + `target` present
- 1: `action` recognized but no `target`
- 0: Cannot determine action

**If clarity < 2 and not autoYes:**

```
AskUserQuestion:
  header: "What would you like to learn?"
  question: |
    I need a bit more detail. What are you trying to do?
  options:
    - "Read through code/docs" → follow
    - "Investigate a question" → investigate
    - "Find patterns in code" → decompose
    - "Get a second opinion" → second-opinion
    - "Review git activity" → retro-git
    - "Evaluate decisions" → retro-decision
    - "Let me rephrase" → re-parse
```

Max 2 clarification rounds. If still unclear: **Error E002**.

---

### Step 4: Select Chain & Confirm

#### 4a: Map resolved command → chain

```javascript
const chainMap = {
  // Single-step chains
  'follow':          [{ cmd: 'learn-follow', args: '{target} {flags}' }],
  'investigate':     [{ cmd: 'learn-investigate', args: '"{target}" {flags}' }],
  'decompose':       [{ cmd: 'learn-decompose', args: '{target} {flags}' }],
  'second-opinion':  [{ cmd: 'learn-second-opinion', args: '{target} {flags}' }],
  'retro-git':       [{ cmd: 'learn-retro-git', args: '{flags}' }],
  'retro-decision':  [{ cmd: 'learn-retro-decision', args: '{flags}' }],

  // Multi-step chains
  'deep-understand': [
    { cmd: 'learn-follow', args: '{target} --depth deep' },
    { cmd: 'learn-decompose', args: '{target} --save-spec' },
    { cmd: 'learn-second-opinion', args: '{target} --mode challenge' }
  ],
  'pattern-catalog': [
    { cmd: 'learn-decompose', args: '{target} --save-spec --save-wiki' },
    { cmd: 'learn-second-opinion', args: '{target} --mode review' }
  ],
  'full-retro': [
    { cmd: 'learn-retro-git', args: '{flags}' },
    { cmd: 'learn-retro-decision', args: '{flags}' }
  ]
};
```

**Chain upgrade heuristic** — single commands may upgrade to multi-step chains when context warrants it:
- `follow` on a large module (>500 LOC) → suggest `deep-understand`
- `decompose` with `--save-spec --save-wiki` → already a full catalog, no upgrade
- User explicitly mentions "thorough" or "deep" or "全面" → upgrade to multi-step

#### 4b: Assemble arguments

- Replace `{target}` with resolved target path/topic/wiki-id
- Replace `{flags}` with extracted flags (--depth, --days, --mode, --scope, etc.)
- Clean empty placeholders

#### 4c: Confirm (skip if autoYes)

**If `$DRY_RUN`:**
```
============================================================
  MAESTRO LEARN: {chain_name} (dry run)
============================================================
  Intent: {original_intent}
  Target: {resolved_target}

  Pipeline:
    1. [{command}] args: {assembled_args}
    ...

  (Use without --dry-run to execute)
============================================================
```
Exit after display.

**If not autoYes:**
```
AskUserQuestion:
  header: "Confirm: {chain_name}"
  question: |
    Execute this learning chain?

    Pipeline:
      1. {command} — {description}
      ...

  options:
    - "Execute" → proceed
    - "Cancel" → exit
```

---

### Step 5: Setup Tracking

```bash
SESSION_ID="learn-$(date +%Y%m%d-%H%M%S)"
SESSION_DIR=".workflow/learning/.maestro-learn/${SESSION_ID}"
mkdir -p "${SESSION_DIR}"
```

Write `${SESSION_DIR}/status.json`:
```json
{
  "session_id": "{SESSION_ID}",
  "created_at": "{ISO timestamp}",
  "intent": "{original_intent}",
  "chain": "{chain_name}",
  "steps": [
    { "index": 0, "cmd": "{command}", "args": "{args}", "status": "pending" }
  ],
  "current_step": 0,
  "auto_mode": false
}
```

---

### Step 6: Execute Chain

For each step in the chain (starting from `$STEP_INDEX` or 0):

1. Update `status.json`: set step status to `"running"`
2. Display step header:
   ```
   ── Step {N}/{total}: {command} ──────────────────────────
   ```
3. Execute: `Skill({ skill: "{command}", args: "{assembled_args}" })`
4. On success:
   - Update step status to `"completed"`
   - Record duration
   - Continue to next step
5. On failure:
   - Update step status to `"failed"`, record error
   - **If autoYes**: skip and continue (log warning)
   - **If interactive**:
     ```
     AskUserQuestion:
       header: "Step {N} failed"
       question: "{error summary}"
       options:
         - "Retry" → re-execute same step
         - "Skip" → continue to next step
         - "Abort" → exit chain
     ```

---

### Step 7: Session Summary

After all steps complete (or chain aborted):

```
=== MAESTRO LEARN SESSION COMPLETE ===
Session: {session_id}
Chain:   {chain_name} ({steps_completed}/{steps_total} steps)
Mode:    {auto | interactive}

Steps:
  [{status_icon}] {N}. {command_name} — {duration}

Artifacts:
  - {list of files written to .workflow/learning/}

Next:
  {suggested_next_action based on chain type}
```

**Next-step routing by chain type:**

| Chain | Suggested next |
|-------|---------------|
| `follow` | "Decompose patterns? → `/maestro-learn --chain decompose`" |
| `investigate` | "Follow-along on discovered code? → `/maestro-learn follow <path>`" |
| `decompose` | "Get second opinion? → `/maestro-learn --chain second-opinion`" |
| `second-opinion` | "Create issue for findings? → `/manage-issue create`" |
| `retro-git` | "Deep dive on hotspot? → `/maestro-learn follow <path>`" |
| `retro-decision` | "Investigate stale decision? → `/maestro-learn investigate <question>`" |
| `deep-understand` | "Browse insights → `/manage-learn list`" |
| `pattern-catalog` | "Load specs → `/spec-load`" |
| `full-retro` | "Browse all insights → `/manage-learn list --tag retro`" |

</execution>

<error_codes>
| Code | Severity | Description | Recovery |
|------|----------|-------------|----------|
| E001 | error | No intent provided and no learning context | Provide a learning goal or target |
| E002 | error | Clarity too low after 2 clarification rounds | Show parsed intent, ask user to rephrase |
| E003 | error | Chain step failed + user chose abort | Record partial progress in status.json |
| E005 | error | Invalid chain name provided with --chain | Show valid chain names: follow, investigate, decompose, second-opinion, retro-git, retro-decision, deep-understand, pattern-catalog, full-retro |
| W001 | warning | Intent ambiguous between two commands | Present options, let user choose |
| W002 | warning | Chain step completed with warnings | Log and continue |
| W003 | warning | `.workflow/learning/` not found | Auto-create and proceed |
</error_codes>

<success_criteria>
- [ ] Intent classified with action, target, clarity_score
- [ ] Command/chain selected and confirmed (or auto-confirmed with -y)
- [ ] Session directory created at `.workflow/learning/.maestro-learn/{session_id}/`
- [ ] status.json tracks per-step progress
- [ ] All chain steps executed via Skill() with proper argument propagation
- [ ] Target resolved (file path, wiki-id, topic) and passed to downstream commands
- [ ] Error handling: retry/skip/abort per step (auto-skip in -y mode)
- [ ] Session summary displayed on completion with next-step routing
- [ ] No files modified outside `.workflow/learning/`
</success_criteria>
