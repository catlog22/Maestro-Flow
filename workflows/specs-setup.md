# Workflow: specs-setup

System specs initialization -- scan project structure, detect tech stack, generate convention files.

## Trigger

- First `/workflow:init` (automatic)
- Manual `/workflow:specs-setup`

## Prerequisites

- Project root must exist
- `.workflow/` directory should exist (create if missing)

## Execution Steps

### Step 1: Ensure Directory Structure

```
Create directories if not present:
  .workflow/
  .workflow/specs/
```

### Step 2: Scan Project Structure

Scan the project root for tech stack indicators:

```
Detection targets:
  package.json        --> Node.js ecosystem (read dependencies for framework detection)
  tsconfig.json       --> TypeScript
  pyproject.toml      --> Python (modern)
  requirements.txt    --> Python (legacy)
  go.mod              --> Go
  Cargo.toml          --> Rust
  pom.xml             --> Java (Maven)
  build.gradle        --> Java/Kotlin (Gradle)
  composer.json       --> PHP
  Gemfile             --> Ruby
  .csproj / .sln      --> .NET/C#
  Dockerfile          --> Container deployment
  docker-compose.yml  --> Multi-container orchestration

Framework detection (from dependency files):
  react / next        --> React / Next.js
  vue                 --> Vue.js
  angular             --> Angular
  express / fastify   --> Node.js server
  django / flask      --> Python web
  gin / echo          --> Go web
  spring              --> Java Spring
```

### Step 3: Write project-tech.json

Output: `.workflow/project-tech.json`

```json
{
  "detected_at": "{ISO timestamp}",
  "languages": ["TypeScript", "..."],
  "frameworks": ["Next.js", "..."],
  "package_manager": "npm | yarn | pnpm | ...",
  "build_system": "tsc | webpack | vite | ...",
  "test_framework": "jest | vitest | pytest | ...",
  "linter": "eslint | prettier | ...",
  "architecture": {
    "type": "monorepo | single-package | ...",
    "entry_points": ["src/index.ts", "..."],
    "key_directories": ["src/", "lib/", "..."]
  }
}
```

### Step 4: Detect Code Patterns

Scan source files for coding conventions:

```
Indentation:  Count leading spaces/tabs in first 20 source files
Naming:       Scan exports for camelCase / PascalCase / snake_case patterns
Imports:      Check import style (named vs default, path aliases, barrel exports)
Formatting:   Check for .prettierrc, .editorconfig, eslint config
File naming:  kebab-case vs camelCase vs PascalCase for source files
```

### Step 5: Generate coding-conventions.md

Output: `.workflow/specs/coding-conventions.md`

```markdown
---
title: "Coding Conventions"
readMode: required
priority: high
category: execution
keywords:
  - style
  - naming
  - import
  - pattern
  - convention
---
# Coding Conventions

Auto-generated from project analysis. Update manually as patterns evolve.

## Formatting
- Indentation: {detected}
- Line length: {detected or "not configured"}
- Trailing commas: {detected}
- Semicolons: {detected}

## Naming
- Variables/functions: {camelCase | snake_case}
- Classes/types: {PascalCase}
- Constants: {UPPER_SNAKE_CASE | camelCase}
- Files: {kebab-case | camelCase | PascalCase}

## Imports
- Style: {named imports | default imports | mixed}
- Path aliases: {@ | ~ | none}
- Order: {built-in, external, internal, relative}

## Patterns
{list detected patterns from codebase analysis}

## Manual Additions
{empty section for user entries}
```

### Step 6: Generate architecture-constraints.md

Output: `.workflow/specs/architecture-constraints.md`

```markdown
---
title: "Architecture Constraints"
readMode: required
priority: high
category: planning
keywords:
  - architecture
  - module
  - layer
  - boundary
  - dependency
---
# Architecture Constraints

Auto-generated from project structure. Update manually as architecture evolves.

## Module Structure
- Type: {monorepo | single-package | multi-package}
- Key modules: {list detected top-level directories with purposes}

## Layer Boundaries
{detected layers: e.g., commands/ -> core/ -> tools/ -> types/}

## Dependency Rules
{detected from imports: which modules import from which}

## Technology Constraints
- Runtime: {Node.js >= X | Python >= X | ...}
- Module system: {ESM | CommonJS | ...}
- Strict mode: {yes | no}

## Manual Additions
{empty section for user entries}
```

### Step 7: Generate learnings.md

Output: `.workflow/specs/learnings.md`

```markdown
---
title: "Learnings"
readMode: optional
priority: medium
category: general
keywords:
  - bug
  - lesson
  - gotcha
---
# Learnings

Bugs, gotchas, and lessons learned during development.
Add entries with: `/workflow:specs-add bug <description>`

## Format

Each entry follows: `- [{YYYY-MM-DD HH:mm}] <description>`

## Entries

{empty -- entries added via specs-add}
```

### Step 8: Generate quality-rules.md

Output: `.workflow/specs/quality-rules.md`

```markdown
---
title: "Quality Rules"
readMode: required
priority: medium
category: execution
keywords:
  - quality
  - rule
  - enforcement
  - standard
---
# Quality Rules

Project-specific quality rules and enforcement criteria.
Add entries with: `/workflow:specs-add rule <description>`

## Format

Each entry follows: `- [{YYYY-MM-DD HH:mm}] <description>`

## Entries

{empty -- entries added via specs-add}
```

### Step 9: Generate debug-notes.md

Output: `.workflow/specs/debug-notes.md`

```markdown
---
title: "Debug Notes"
readMode: optional
priority: medium
category: debug
keywords:
  - debug
  - issue
  - workaround
  - root-cause
  - gotcha
---
# Debug Notes

Known issues, debugging tips, and root cause records.
Add entries with: `/spec-add debug <description>`

## Entries

{empty -- entries added via spec-add}
```

### Step 10: Generate test-conventions.md

Output: `.workflow/specs/test-conventions.md`

Scan existing test files for conventions (framework, naming, directory structure, patterns).

```markdown
---
title: "Test Conventions"
readMode: required
priority: high
category: test
keywords:
  - test
  - coverage
  - mock
  - fixture
  - assertion
  - framework
---
# Test Conventions

Auto-generated from project analysis. Update manually as patterns evolve.

## Framework
- Framework: {detected: Jest | Vitest | pytest | Mocha | none}
- Run command: {detected: npm test | pytest | etc.}

## Directory Structure
- Pattern: {detected: __tests__/ | tests/ | co-located | etc.}

## Naming Conventions
- Test files: {detected: *.test.ts | *.spec.ts | test_*.py | etc.}

## Patterns
{detected patterns from existing test files: describe/it nesting, assertion style, mock patterns}

## Manual Additions

```

### Step 11: Generate review-standards.md

Output: `.workflow/specs/review-standards.md`

```markdown
---
title: "Review Standards"
readMode: required
priority: medium
category: review
keywords:
  - review
  - checklist
  - gate
  - approval
  - standard
---
# Review Standards

## Review Checklist

## Quality Gates

## Manual Additions

```

### Step 12: Generate validation-rules.md

Output: `.workflow/specs/validation-rules.md`

```markdown
---
title: "Validation Rules"
readMode: required
priority: high
category: validation
keywords:
  - validation
  - verification
  - acceptance
  - criteria
  - check
---
# Validation Rules

## Verification Criteria

## Acceptance Standards

## Manual Additions

```

### Step 13: Summary

Display what was created:
```
Specs initialized:
  .workflow/project-tech.json        -- Tech stack analysis
  .workflow/specs/coding-conventions.md    (category: execution)
  .workflow/specs/architecture-constraints.md (category: planning)
  .workflow/specs/learnings.md             (category: general)
  .workflow/specs/quality-rules.md         (category: execution)
  .workflow/specs/debug-notes.md           (category: debug)
  .workflow/specs/test-conventions.md      (category: test)
  .workflow/specs/review-standards.md      (category: review)
  .workflow/specs/validation-rules.md      (category: validation)
```

## Output

All files listed above under `.workflow/`.
