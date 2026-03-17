/**
 * Maestro Statusline Hook
 *
 * Displays: model | phase | task | directory | ASCII-face context bar
 * Writes bridge file for context-monitor hook consumption.
 *
 * Input (stdin JSON from Claude Code):
 *   { model, workspace, session_id, context_window }
 *
 * Output (stdout): formatted statusline string
 */

import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import {
  AUTO_COMPACT_BUFFER_PCT,
  BRIDGE_PREFIX,
  FACES,
  FACE_COLORS,
  ANSI_RESET,
  ANSI_DIM,
  ANSI_BOLD,
  ANSI_CYAN,
  getFaceLevel,
} from './constants.js';

interface StatuslineInput {
  model?: { display_name?: string };
  workspace?: { current_dir?: string };
  session_id?: string;
  context_window?: { remaining_percentage?: number };
}

interface BridgeData {
  session_id: string;
  remaining_percentage: number;
  used_pct: number;
  timestamp: number;
}

/** Normalize remaining% to usable context (accounts for autocompact buffer) */
function normalizeUsage(remaining: number): number {
  const usableRemaining = Math.max(
    0,
    ((remaining - AUTO_COMPACT_BUFFER_PCT) / (100 - AUTO_COMPACT_BUFFER_PCT)) * 100
  );
  return Math.max(0, Math.min(100, Math.round(100 - usableRemaining)));
}

/**
 * Build the context bar: face [=====-----] 62%
 */
function buildContextBar(usedPct: number): string {
  const level = getFaceLevel(usedPct);
  const face = FACES[level];
  const color = FACE_COLORS[level];
  const filled = Math.floor(usedPct / 10);
  const bar = '='.repeat(filled) + '-'.repeat(10 - filled);
  return ` ${color}${face} [${bar}] ${usedPct}%${ANSI_RESET}`;
}

/** Write bridge file for context-monitor to consume */
function writeBridge(session: string, remaining: number, usedPct: number): void {
  try {
    const bridgePath = join(tmpdir(), `${BRIDGE_PREFIX}${session}.json`);
    const data: BridgeData = {
      session_id: session,
      remaining_percentage: remaining,
      used_pct: usedPct,
      timestamp: Math.floor(Date.now() / 1000),
    };
    writeFileSync(bridgePath, JSON.stringify(data));
  } catch {
    // Silent fail — bridge is best-effort
  }
}

/** Read current in-progress task from Claude Code todos */
function readCurrentTask(session: string): string {
  const claudeDir = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
  const todosDir = join(claudeDir, 'todos');
  if (!existsSync(todosDir)) return '';

  try {
    const files = readdirSync(todosDir)
      .filter((f) => f.startsWith(session) && f.includes('-agent-') && f.endsWith('.json'))
      .map((f) => ({ name: f, mtime: statSync(join(todosDir, f)).mtime }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    if (files.length > 0) {
      const todos = JSON.parse(readFileSync(join(todosDir, files[0].name), 'utf8'));
      const inProgress = todos.find((t: { status: string; activeForm?: string }) => t.status === 'in_progress');
      if (inProgress) return inProgress.activeForm || '';
    }
  } catch {
    // Silently fail
  }
  return '';
}

/** Read current phase from .workflow/state.json */
function readPhase(dir: string): string {
  const statePath = join(dir, '.workflow', 'state.json');
  if (!existsSync(statePath)) return '';
  try {
    const state = JSON.parse(readFileSync(statePath, 'utf8'));
    if (state.current_phase) {
      let label = `P${state.current_phase}`;
      if (state.current_step) label += `.${state.current_step}`;
      return label;
    }
  } catch {
    // Silently fail
  }
  return '';
}

/** Main statusline handler — processes input and returns formatted string */
export function formatStatusline(data: StatuslineInput): string {
  const model = data.model?.display_name || 'Claude';
  const dir = data.workspace?.current_dir || process.cwd();
  const session = data.session_id || '';
  const remaining = data.context_window?.remaining_percentage;

  // Context bar + bridge write
  let ctx = '';
  if (remaining != null) {
    const usedPct = normalizeUsage(remaining);
    if (session) writeBridge(session, remaining, usedPct);
    ctx = buildContextBar(usedPct);
  }

  // Current task
  const task = session ? readCurrentTask(session) : '';

  // Phase from .workflow/
  const phase = readPhase(dir);

  // Assemble segments
  const parts: string[] = [`${ANSI_DIM}${model}${ANSI_RESET}`];
  if (phase) parts.push(`${ANSI_CYAN}${phase}${ANSI_RESET}`);
  if (task)  parts.push(`${ANSI_BOLD}${task}${ANSI_RESET}`);
  parts.push(`${ANSI_DIM}${basename(dir)}${ANSI_RESET}`);

  return parts.join(' | ') + ctx;
}

/** Entry point — reads stdin JSON, writes formatted statusline to stdout */
export function runStatusline(): void {
  let input = '';
  const timeout = setTimeout(() => process.exit(0), 3000);

  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => (input += chunk));
  process.stdin.on('end', () => {
    clearTimeout(timeout);
    try {
      const data: StatuslineInput = JSON.parse(input);
      process.stdout.write(formatStatusline(data));
    } catch {
      // Silent fail
    }
  });
}
