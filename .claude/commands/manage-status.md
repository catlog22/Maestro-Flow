---
name: manage-status
description: Display project dashboard with phase progress, active tasks, and next steps
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
---
<purpose>
Display a unified project dashboard showing phase progress, task counts, active work, and intelligent next-step suggestions.
Reads all state files from `.workflow/` and renders a formatted overview with progress bars and status tables.
Provides situational awareness before continuing work.
</purpose>

<required_reading>
@~/.maestro/workflows/status.md
</required_reading>

<context>
$ARGUMENTS (no arguments required)

**State files read:**
- `.workflow/state.json` -- project-level state machine
- `.workflow/roadmap.md` -- milestone and phase structure
- `.workflow/phases/*/index.json` -- per-phase metadata and progress
- `.workflow/phases/*/.task/TASK-*.json` -- individual task statuses
</context>

<execution>
Follow '~/.maestro/workflows/status.md' completely.

**Next-step decision table:**
| Current state | Suggested command | Reason |
|---------------|-------------------|--------|
| No phases planned | Skill({ skill: "maestro-brainstorm", args: "1" }) or Skill({ skill: "maestro-plan", args: "1" }) | Explore ideas or start planning first phase |
| Phase pending, needs analysis | Skill({ skill: "maestro-analyze", args: "<N>" }) | Evaluate feasibility before planning |
| Phase pending, needs decisions | Skill({ skill: "maestro-analyze", args: "<N> -q" }) | Quick decision extraction |
| Phase planned, not executed | Skill({ skill: "maestro-execute", args: "<N>" }) | Execute the planned phase |
| Phase executing, tasks blocked | Skill({ skill: "quality-debug", args: "<N>" }) | Unblock stuck tasks |
| Phase executed, not verified | Skill({ skill: "maestro-verify", args: "<N>" }) | Verify execution results |
| Phase verified with gaps | Skill({ skill: "maestro-plan", args: "<N> --gaps" }) | Plan gap fixes |
| Phase verified, not reviewed | Skill({ skill: "quality-review", args: "<N>" }) | Code quality review before UAT |
| Phase reviewed, verdict BLOCK | Skill({ skill: "maestro-plan", args: "<N> --gaps" }) | Fix critical review findings first |
| Phase reviewed, verdict PASS/WARN | Skill({ skill: "quality-test", args: "<N>" }) | Proceed to UAT testing |
| Phase verified, low test coverage | Skill({ skill: "quality-test-gen", args: "<N>" }) | Generate missing automated tests |
| UAT passed | Skill({ skill: "maestro-phase-transition" }) | Move to next phase |
| UAT has failures | Skill({ skill: "quality-debug", args: "--from-uat <N>" }) | Debug UAT gaps with parallel agents |
| Need integration test cycle | Skill({ skill: "quality-integration-test", args: "<N>" }) | Self-iterating integration tests |
| All phases in milestone complete | Skill({ skill: "maestro-milestone-audit" }) | Cross-phase integration check |
| Milestone audit passed | Skill({ skill: "maestro-milestone-complete" }) | Archive milestone, advance |
| Ad-hoc small task | Skill({ skill: "maestro-quick", args: "<task>" }) | Quick execute without full pipeline |
</execution>

<error_codes>
| Code | Severity | Description | Stage |
|------|----------|-------------|-------|
| E001 | fatal | `.workflow/` not initialized -- run Skill({ skill: "maestro-init" }) first | parse_input |
| E002 | fatal | `state.json` missing or corrupt -- project state unrecoverable | parse_input |
</error_codes>

<success_criteria>
- [ ] Project state loaded from `state.json`
- [ ] Roadmap parsed with milestone/phase structure
- [ ] Per-phase progress calculated (task counts, completion %)
- [ ] Dashboard rendered with progress bars and status table
- [ ] Active work section shows current phase details
- [ ] Next steps suggested based on current state analysis
</success_criteria>
