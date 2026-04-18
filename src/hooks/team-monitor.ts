/**
 * Maestro Team Monitor — PostToolUse Hook (team-lite Wave 2b).
 *
 * Silent heartbeat: every PostToolUse event appends a line to the shared
 * `.workflow/collab/activity.jsonl` so teammates can see who is active
 * on which phase/task.
 *
 * Design constraints (docs/team-lite-design.md section "耦合 1"):
 *   - Team mode off (no member record) -> silent exit 0.
 *   - `user` / `host` come from `members/{uid}.json` via `resolveSelf()`.
 *   - `phase_id` / `task_id` come from `.workflow/state.json` via
 *     `readWorkflowContext()`.
 *   - `action` comes from the hook payload's `tool_name`.
 *   - Dedupe: same `(user, action, phase_id)` within 60s -> skip.
 *     This defends against sub-agent Wave amplification.
 *   - Never throw: this hook must never block the host tool call.
 *   - No hook stdout output (unlike context-monitor / delegate-monitor,
 *     which inject `additionalContext`). The heartbeat is side-effect only.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { resolveSelf } from '../tools/team-members.js';
import { reportActivity, readWorkflowContext } from '../tools/team-activity.js';
import { evaluateNamespaceGuard } from '../tools/namespace-guard.js';
import { getProjectRoot } from '../utils/path-validator.js';

interface HookInput {
  session_id?: string;
  cwd?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
}

interface DedupeState {
  key: string;
  ts: number;
}

// 60 seconds — matches design doc "耦合 1" dedupe window.
const DEDUPE_WINDOW_MS = 60_000;

const DEDUPE_PREFIX = 'maestro-team-dedupe-';

function getDedupePath(sessionId: string): string {
  return join(tmpdir(), `${DEDUPE_PREFIX}${sessionId}.json`);
}

/**
 * Returns true if the (sessionId, key) combo was reported within the
 * dedupe window and should be suppressed. Updates the state file on
 * every call so the next check has a fresh baseline.
 *
 * If `sessionId` is missing we cannot persist per-session state, so we
 * return `false` (never suppress) — better to log an extra heartbeat
 * than to lose them all.
 */
function shouldSkipDuplicate(sessionId: string | undefined, key: string): boolean {
  if (!sessionId) return false;

  const path = getDedupePath(sessionId);
  const now = Date.now();

  if (existsSync(path)) {
    try {
      const raw = readFileSync(path, 'utf-8');
      const prev = JSON.parse(raw) as Partial<DedupeState>;
      if (
        prev &&
        typeof prev.key === 'string' &&
        typeof prev.ts === 'number' &&
        prev.key === key &&
        now - prev.ts < DEDUPE_WINDOW_MS
      ) {
        return true;
      }
    } catch {
      // Corrupted — fall through and overwrite.
    }
  }

  try {
    const next: DedupeState = { key, ts: now };
    writeFileSync(path, JSON.stringify(next), 'utf-8');
  } catch {
    // Best-effort: if we cannot persist, we still report the event.
  }
  return false;
}

/**
 * Pure hook logic — takes parsed hook input, reports activity if
 * team mode is enabled. Never throws.
 */
export function runTeamMonitor(input: HookInput): void {
  try {
    const self = resolveSelf();
    if (!self) return; // Team mode not enabled — silent exit.

    const action =
      typeof input.tool_name === 'string' && input.tool_name.length > 0
        ? input.tool_name
        : 'unknown';

    // Namespace guard: check file write operations stay within boundaries.
    // V1 is advisory — log warning but never block.
    if (input.tool_input && (action === 'Write' || action === 'Edit')) {
      const filePath =
        typeof input.tool_input.file_path === 'string'
          ? input.tool_input.file_path
          : typeof input.tool_input.path === 'string'
            ? input.tool_input.path
            : undefined;

      if (filePath) {
        // Detect task file writes to .workflow/collab/tasks/
        if (filePath.includes('.workflow/collab/tasks/') || filePath.includes('.workflow\\collab\\tasks\\')) {
          const match = filePath.match(/tasks[\\/](TASK-\d+)\.json$/);
          if (match) {
            reportActivity({
              user: self.uid,
              host: self.host,
              action: 'task.edit',
              task_id: match[1],
              target: action.toLowerCase(),
            });
            return; // Report once for task edits; skip generic heartbeat below.
          }
        }

        // Namespace guard: check file write operations stay within boundaries.
        // V1 is advisory — log warning but never block.
        const guardResult = evaluateNamespaceGuard(
          filePath,
          self.uid,
          getProjectRoot(),
        );
        if (!guardResult.allowed) {
          console.error(
            `[TeamMonitor] WARNING: namespace violation (advisory): ${guardResult.reason}`,
          );
        }
      }
    }

    const ctx = readWorkflowContext();

    const dedupeKey = `${self.uid}|${action}|${ctx.phase_id ?? ''}`;
    if (shouldSkipDuplicate(input.session_id, dedupeKey)) return;

    reportActivity({
      user: self.uid,
      host: self.host,
      action,
      ...(ctx.phase_id !== undefined ? { phase_id: ctx.phase_id } : {}),
      ...(ctx.task_id !== undefined ? { task_id: ctx.task_id } : {}),
    });
  } catch {
    // Never block the host tool call.
  }
}

/** Entry point — reads stdin JSON with 3s timeout, runs monitor, exits 0. */
export function runTeamMonitorFromStdin(): void {
  let input = '';
  const timeout = setTimeout(() => process.exit(0), 3000);

  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => (input += chunk));
  process.stdin.on('end', () => {
    clearTimeout(timeout);
    try {
      const data: HookInput = input ? JSON.parse(input) : {};
      runTeamMonitor(data);
    } catch {
      // Silent fail — never block tool execution.
    }
    process.exit(0);
  });
}
