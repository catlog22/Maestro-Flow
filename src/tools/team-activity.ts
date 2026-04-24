/**
 * Human-team activity log (team-lite collaboration, Wave 2).
 *
 * Owns `.workflow/collab/activity.jsonl` — append-only activity bus shared
 * across a small human team. Each entry records "who did what, when, where".
 *
 * Strict namespace separation: this module belongs to the HUMAN collaboration
 * domain (`.workflow/collab/`) and must NEVER touch `.workflow/.team/` which
 * is the agent pipeline message bus owned by `src/tools/team-msg.ts`.
 *
 * Hot-path contract: `reportActivity` is called from PostToolUse hooks and
 * must NEVER throw. The underlying `appendLine` from `src/utils/jsonl-log.ts`
 * already swallows errors; we rely on that and add best-effort wrappers.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { getProjectRoot } from '../utils/path-validator.js';
import { appendLine, tailLast, rotateIfLarge } from '../utils/jsonl-log.js';

export interface ActivityEvent {
  ts: string; // ISO 8601 UTC
  user: string; // uid (from members)
  host: string; // os.hostname()
  action: string; // command or tool name
  phase_id?: number;
  task_id?: string;
  target?: string;
}

// Max lines read from the tail for recent-activity queries. Cap matches
// the preflight algorithm described in docs/team-lite-design.md (section
// "耦合 3"): 500 lines is plenty for a ±35 min window on a small team.
const RECENT_READ_LIMIT = 500;

// Clock tolerance (minutes): include events slightly older than the window
// edge to account for cross-machine clock drift. Matches design doc.
const CLOCK_TOLERANCE_MIN = 5;

// Default rotation threshold: 10 MB.
const DEFAULT_ROTATE_BYTES = 10 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/** Absolute path to the current activity log. */
export function getActivityLogPath(): string {
  return join(getProjectRoot(), '.workflow', 'collab', 'activity.jsonl');
}

/** Absolute path to the activity archive directory. */
export function getArchiveDir(): string {
  return join(getProjectRoot(), '.workflow', 'collab', 'activity-archives');
}

function getStateJsonPath(): string {
  return join(getProjectRoot(), '.workflow', 'state.json');
}

// ---------------------------------------------------------------------------
// Write path
// ---------------------------------------------------------------------------

/**
 * Append an activity event to the shared log.
 *
 * - `ts` is auto-filled to `new Date().toISOString()` if omitted.
 * - Silently no-ops on any error — this is called from hot paths.
 */
export function reportActivity(
  evt: Omit<ActivityEvent, 'ts'> & { ts?: string },
): void {
  try {
    const full: ActivityEvent = {
      ts: evt.ts ?? new Date().toISOString(),
      user: evt.user,
      host: evt.host,
      action: evt.action,
      ...(evt.phase_id !== undefined ? { phase_id: evt.phase_id } : {}),
      ...(evt.task_id !== undefined ? { task_id: evt.task_id } : {}),
      ...(evt.target !== undefined ? { target: evt.target } : {}),
    };
    appendLine(getActivityLogPath(), full);
  } catch {
    // Hot path — never throw.
  }
}

// ---------------------------------------------------------------------------
// Read path
// ---------------------------------------------------------------------------

/**
 * Return activity events from the last `windowMinutes` minutes.
 *
 * Algorithm (matches docs/team-lite-design.md section "耦合 3"):
 *   1. Tail the last 500 lines of activity.jsonl.
 *   2. Drop malformed entries (`tailLast` already does this).
 *   3. Keep events with `ts >= now - (windowMinutes + CLOCK_TOLERANCE_MIN)`
 *      to absorb cross-machine clock drift.
 *
 * Results are returned in the natural tail order (oldest -> newest), which
 * is what `team status` wants for grouping by user.
 */
export function readRecentActivity(windowMinutes: number): ActivityEvent[] {
  if (windowMinutes <= 0) return [];

  const entries = tailLast<ActivityEvent>(
    getActivityLogPath(),
    RECENT_READ_LIMIT,
  );
  if (entries.length === 0) return [];

  const cutoff = Date.now() - (windowMinutes + CLOCK_TOLERANCE_MIN) * 60 * 1000;

  const out: ActivityEvent[] = [];
  for (const e of entries) {
    if (!e || typeof e.ts !== 'string') continue;
    const t = Date.parse(e.ts);
    if (Number.isNaN(t)) continue;
    if (t >= cutoff) out.push(e);
  }
  return out;
}

/**
 * Read the current workflow context from `.workflow/state.json`.
 *
 * Returns:
 *   - `phase_id` from `current_phase` (if present & numeric)
 *   - `task_id`  from `current_task_id` (if present & string)
 *
 * Both fields are optional. Missing state file, parse errors, or missing
 * fields return `{}` — callers tag activity events with whatever is known.
 *
 * Note: `current_task_id` depends on P0.1 which may not be landed yet.
 */
export function readWorkflowContext(): { phase_id?: number; task_id?: string } {
  const statePath = getStateJsonPath();
  if (!existsSync(statePath)) return {};

  let raw: string;
  try {
    raw = readFileSync(statePath, 'utf-8');
  } catch {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }

  if (!parsed || typeof parsed !== 'object') return {};
  const obj = parsed as Record<string, unknown>;

  const out: { phase_id?: number; task_id?: string } = {};
  if (typeof obj.current_phase === 'number') {
    out.phase_id = obj.current_phase;
  } else if (Array.isArray(obj.artifacts) && Array.isArray(obj.milestones)) {
    // v2: derive current phase from artifact registry
    const milestone = (obj.milestones as Array<{ name?: string; phases?: number[] }>)
      .find(m => m.name === obj.current_milestone);
    if (milestone?.phases?.length) {
      const arts = obj.artifacts as Array<{ type?: string; phase?: number; milestone?: string; status?: string }>;
      for (const p of milestone.phases) {
        if (arts.some(a => a.phase === p && a.milestone === obj.current_milestone && a.status === 'in_progress')) {
          out.phase_id = p; break;
        }
      }
      if (out.phase_id == null) {
        for (const p of milestone.phases) {
          if (!arts.some(a => a.type === 'execute' && a.phase === p && a.milestone === obj.current_milestone && a.status === 'completed')) {
            out.phase_id = p; break;
          }
        }
      }
    }
  }
  if (typeof obj.current_task_id === 'string' && obj.current_task_id) {
    out.task_id = obj.current_task_id;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Maintenance
// ---------------------------------------------------------------------------

/**
 * Rotate the activity log if it exceeds `maxBytes`.
 *
 * Delegates to `rotateIfLarge` in `src/utils/jsonl-log.ts`, which moves the
 * file to `.workflow/collab/activity-archives/activity-{YYYY}W{WW}.jsonl`.
 *
 * Returns the archive path on success, or `null` if rotation did not run
 * (file missing, below threshold, or I/O error).
 */
export function rotateIfNeeded(maxBytes: number = DEFAULT_ROTATE_BYTES): string | null {
  return rotateIfLarge(getActivityLogPath(), maxBytes, getArchiveDir());
}
