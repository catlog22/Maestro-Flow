# UI Style Workflow (ui-ux-pro-max powered)

Lightweight design workflow delegating to ui-ux-pro-max for design system generation.
Command owns: requirements gathering, variant presentation, user selection, solidification.

Pipeline position: analyze -> **ui-design** -> plan -> execute -> verify

---

## Prerequisites

- `.workflow/` directory initialized
- Phase directory OR scratch mode
- Python 3 + ui-ux-pro-max skill installed (SKILL_PATH resolved by command)

---

## Phase Resolution

```
Input: <phase> argument (number or slug) OR topic text

IF argument is a number or matches phase pattern:
  Read .workflow/state.json → state
  artifacts = state.artifacts ?? []
  art = artifacts.find(a => a.phase === phaseNum)
  IF art:
    PHASE_DIR = ".workflow/" + art.path
  ELSE:
    ERROR "Phase {phaseNum} not found in artifact registry"
  Set SCRATCH_MODE = false

ELSE (topic text — scratch mode):
  1. slug = slugify(topic)
  2. PHASE_DIR = .workflow/scratch/ui-design-{slug}-{YYYYMMDD}
  3. mkdir -p ${PHASE_DIR}
  4. Create minimal index.json (type="ui-design", goal=topic)
  5. Set SCRATCH_MODE = true
```

---

## Flag Processing

| Flag | Default | Effect |
|------|---------|--------|
| `--styles N` | 3 | Number of style variants (2-5) |
| `--stack <stack>` | html-tailwind | Tech stack for guidelines |
| `--targets <pages>` | (inferred) | Comma-separated page targets |
| `--persist` | false | Save with hierarchical page overrides |
| `-y` | false | Auto mode: skip interactive selection |

---

### Step 1: Setup

**1a. Parse flags:**
```javascript
const styleCount = clamp(parseInt($ARGUMENTS.match(/--styles\s+(\d+)/)?.[1]) || 3, 2, 5)
const stack = $ARGUMENTS.match(/--stack\s+(\S+)/)?.[1] || 'html-tailwind'
const targets = $ARGUMENTS.match(/--targets\s+"?([^"]+)"?/)?.[1]?.split(',').map(s => s.trim()) || null
const persist = /--persist/.test($ARGUMENTS)
const autoMode = /\b(-y|--yes)\b/.test($ARGUMENTS)
```

**1b. Create output directories:**
```bash
mkdir -p "${PHASE_DIR}/design-ref/prototypes"
mkdir -p "${PHASE_DIR}/design-ref/layout-templates"
```

**1c. Display banner:**
```
============================================================
  MAESTRO UI DESIGN (ui-ux-pro-max)
============================================================
  Phase:   {phase_name or topic}
  Styles:  {styleCount} variants
  Stack:   {stack}
  Targets: {targets or "auto-detect"}
```

---

### Step 2: Gather Requirements Context

**2a. Load phase context** (if exists):
```
Read ${PHASE_DIR}/context.md
  Extract: product type, industry, audience, design preferences
```

**2b. Load brainstorm results** (if exists):
```
IF exists ${PHASE_DIR}/brainstorm/:
  Scan for ui-designer/analysis.md, product-manager/analysis.md
  Extract: visual direction keywords, user persona, product type
```

**2c. Load spec reference** (if exists):
```
IF index.json.spec_ref:
  Read spec-summary.md -> extract UI-relevant requirements
```

**2d. Synthesize design brief:**
```
product_type = "SaaS dashboard | e-commerce | landing page | ..."
industry = "fintech | healthcare | beauty | ..."
style_keywords = "modern minimalist | bold geometric | ..."
audience = "enterprise users | young consumers | ..."
```

**2e. Infer targets** (if not specified):
```
Extract page names from phase goal / brainstorm / spec
FALLBACK -> targets = ["home"]
```

**2f. Interactive brief review** (skip if -y):
```
Present brief, allow adjustments.
"Design Brief: Product={product_type}, Industry={industry}, Style={style_keywords}"
"Modify? (enter changes or 'ok')"
```

---

### Step 3: Generate Style Variants via ui-ux-pro-max

**Purpose:** Call ui-ux-pro-max multiple times with different keyword emphasis to produce contrasting variants.

#### 3a. Build variant keyword sets

Generate `styleCount` keyword sets with intentional contrast:

```javascript
// Example for styleCount=3:
variant_keywords = [
  "${product_type} ${industry} minimal clean professional",       // Conservative
  "${product_type} ${industry} bold vibrant modern creative",     // Expressive
  "${product_type} ${industry} elegant luxury sophisticated soft" // Premium
]
// Adjust based on design brief. Key: each set produces a DIFFERENT design direction.
```

#### 3b. Call ui-ux-pro-max for each variant (parallel)

```bash
# Variant N — design system
python3 "${SKILL_PATH}" "${variant_keywords[N]}" --design-system -p "${project_name}" -f markdown

# Stack guidelines (once)
python3 "${SKILL_PATH}" "layout responsive form component" --stack ${stack}

# Domain supplements (once, parallel)
python3 "${SKILL_PATH}" "${industry} ${product_type}" --domain color
python3 "${SKILL_PATH}" "accessibility animation interaction" --domain ux
```

Save each variant result to `${PHASE_DIR}/design-ref/prototypes/variant-{N}-system.md`.

#### 3c. Present variants (skip if -y)

```
============================================================
  STYLE VARIANTS
============================================================

  Variant 1: {pattern_name} — {style_name}
    Colors: {primary palette description}
    Typography: {heading} + {body}
    Effects: {key effects}
    Anti-patterns: {what to avoid}

  Variant 2: {pattern_name} — {style_name}
    ...

  Variant 3: {pattern_name} — {style_name}
    ...

  Select: [1-N | "redo" | "all"]
```

If auto mode: select variant 1.
If "redo": regenerate with adjusted keywords, back to 3a.

---

### Step 4: Solidify Selected Design

**Purpose:** Map ui-ux-pro-max output to design-ref/ structure for downstream plan/execute.

#### 4a. Persist via ui-ux-pro-max

```bash
# Generate MASTER.md + pages/ for selected variant
python3 "${SKILL_PATH}" "${selected_variant_keywords}" --design-system --persist -p "${project_name}"

# If --persist and targets specified, generate page overrides
for target in ${targets}; do
  python3 "${SKILL_PATH}" "${selected_variant_keywords} ${target}" --design-system --persist -p "${project_name}" --page "${target}"
done
```

#### 4b. Generate design-tokens.json

Spawn agent to extract structured tokens from MASTER.md:

```javascript
Agent(ui-design-agent): `
  [DESIGN_TOKEN_EXTRACTION]
  Extract production-ready design tokens from ui-ux-pro-max MASTER.md output.

  ## Input
  Read: design-system/MASTER.md (generated by ui-ux-pro-max)

  ## Output
  Write: ${PHASE_DIR}/design-ref/design-tokens.json

  Schema:
  {
    "colors": {
      "brand": { "primary": "oklch(...)", "secondary": "oklch(...)", "accent": "oklch(...)" },
      "surface": { "background": "oklch(...)", "elevated": "oklch(...)", "card": "oklch(...)" },
      "semantic": { "success": "oklch(...)", "warning": "oklch(...)", "error": "oklch(...)", "info": "oklch(...)" },
      "text": { "primary": "oklch(...)", "secondary": "oklch(...)", "tertiary": "oklch(...)", "inverse": "oklch(...)" },
      "border": { "default": "oklch(...)", "strong": "oklch(...)", "subtle": "oklch(...)" }
    },
    "typography": {
      "font_family": { "heading": "...", "body": "...", "mono": "..." },
      "font_size": { "xs": "0.75rem", "sm": "0.875rem", "base": "1rem", "lg": "1.125rem", "xl": "1.25rem", "2xl": "1.5rem", "3xl": "1.875rem", "4xl": "2.25rem", "5xl": "3rem" },
      "font_weight": { "normal": "400", "medium": "500", "semibold": "600", "bold": "700" },
      "line_height": { "tight": "1.25", "normal": "1.5", "relaxed": "1.75" },
      "combinations": {
        "heading-primary": { "family": "var(--font-family-heading)", "size": "var(--font-size-3xl)", "weight": "var(--font-weight-bold)", "line_height": "var(--line-height-tight)" },
        "body-regular": { "family": "var(--font-family-body)", "size": "var(--font-size-base)", "weight": "var(--font-weight-normal)", "line_height": "var(--line-height-normal)" }
      }
    },
    "spacing": { "1": "0.25rem", "2": "0.5rem", "3": "0.75rem", "4": "1rem", "6": "1.5rem", "8": "2rem", "12": "3rem", "16": "4rem" },
    "border_radius": { "sm": "0.25rem", "md": "0.5rem", "lg": "1rem", "xl": "1.5rem", "full": "9999px" },
    "shadows": { "sm": "...", "md": "...", "lg": "...", "xl": "..." },
    "component_styles": {
      "button": { "primary": {...}, "secondary": {...} },
      "card": { "default": {...} },
      "input": { "default": {...} }
    },
    "breakpoints": { "sm": "640px", "md": "768px", "lg": "1024px", "xl": "1280px" }
  }

  ## Rules
  - Convert hex/rgb colors from MASTER.md to OKLCH format
  - Use var() references in component_styles and typography.combinations
  - WCAG AA: 4.5:1 text contrast, 3:1 UI contrast
  - Map ui-ux-pro-max pattern/style/color/typography into structured tokens
`
```

#### 4c. Generate animation-tokens.json

```javascript
Agent(ui-design-agent): `
  [ANIMATION_TOKEN_EXTRACTION]
  Generate animation tokens complementing the design system.

  ## Input
  Read: ${PHASE_DIR}/design-ref/design-tokens.json (for style context)
  Read: design-system/MASTER.md (for animation/effect guidance)

  ## Output
  Write: ${PHASE_DIR}/design-ref/animation-tokens.json

  Schema:
  {
    "duration": { "instant": "0ms", "fast": "100ms", "normal": "200ms", "slow": "300ms", "slower": "500ms" },
    "easing": { "ease-out": "cubic-bezier(0.0, 0, 0.2, 1)", "ease-in-out": "cubic-bezier(0.4, 0, 0.2, 1)", "spring": "cubic-bezier(0.34, 1.56, 0.64, 1)" },
    "transitions": { "color": "color var(--duration-normal) var(--easing-ease-out)", "transform": "transform var(--duration-normal) var(--easing-ease-out)", "opacity": "opacity var(--duration-fast) var(--easing-ease-out)" },
    "keyframes": { "fadeIn": {...}, "slideUp": {...} },
    "interactions": { "button-hover": {...}, "card-hover": {...} },
    "reduced_motion": { "strategy": "remove-motion-keep-opacity", "media_query": "@media (prefers-reduced-motion: reduce)" }
  }
`
```

#### 4d. Map files to design-ref/

```bash
# Copy MASTER.md from ui-ux-pro-max output to design-ref/
cp design-system/MASTER.md "${PHASE_DIR}/design-ref/MASTER.md"

# Copy page overrides if generated
if [ -d "design-system/pages" ]; then
  mkdir -p "${PHASE_DIR}/design-ref/pages"
  cp design-system/pages/*.md "${PHASE_DIR}/design-ref/pages/"
fi
```

#### 4e. Write selection.json

```json
{
  "selected_variant": 1,
  "variant_name": "{pattern_name} — {style_name}",
  "selection_mode": "user_choice|auto",
  "source": "ui-ux-pro-max",
  "keywords": "{selected_variant_keywords}",
  "selected_at": "ISO timestamp"
}
```

#### 4f. Optional: Generate HTML prototype

For each target, spawn agent to assemble a single preview HTML:

```javascript
Agent(ui-design-agent): `
  [PROTOTYPE_GENERATION — ${target}]
  Generate standalone HTML prototype from design tokens.

  ## Input
  Read: ${PHASE_DIR}/design-ref/design-tokens.json
  Read: ${PHASE_DIR}/design-ref/animation-tokens.json
  Read: ${PHASE_DIR}/design-ref/MASTER.md

  ## Output
  Write: ${PHASE_DIR}/design-ref/prototypes/${target}.html

  ## Rules
  - Standalone HTML with embedded CSS (no external deps except Google Fonts CDN)
  - Realistic placeholder content (contextual to ${product_type}, NOT lorem ipsum)
  - SVG icons (Heroicons/Lucide CDN), NOT emojis
  - cursor-pointer on clickable elements
  - Responsive at 375px, 768px, 1024px
  - WCAG AA contrast
  - prefers-reduced-motion respected
`
```

#### 4g. Update index.json

```json
{
  "design_ref": {
    "status": "selected",
    "variant": "{variant_name}",
    "source": "ui-ux-pro-max",
    "master": "design-ref/MASTER.md",
    "tokens": "design-ref/design-tokens.json",
    "animation": "design-ref/animation-tokens.json",
    "prototypes": "design-ref/prototypes/",
    "created_at": "ISO timestamp"
  }
}
```

---

## Escalation

If the design needs exceed ui-ux-pro-max capabilities (e.g., multi-layout matrix, 6D attribute space exploration, full style x layout x target prototype grid), suggest:

```
For advanced multi-layer design exploration:
  Skill({ skill: "maestro-ui-design", args: "{phase} --full" })
```

---

## Integration with maestro-plan

Same as ui-design.md — plan.md Step 4b detects `design-ref/MASTER.md` and includes tokens in task `read_first[]`.

---

## Error Handling

| Error | Action |
|-------|--------|
| ui-ux-pro-max returns empty | Retry with broader keywords, then abort |
| Token extraction agent fails | Retry once, warn if still fails |
| User cancels selection | Save all variants, exit without solidification |

---

## State Updates

| When | Field | Value |
|------|-------|-------|
| Step 1 start | index.json.status | "designing" |
| Step 4 complete | index.json.design_ref.status | "selected" |
| Step 4 complete | index.json.updated_at | Current timestamp |
