// ---------------------------------------------------------------------------
// Spawn environment cleanup (AionUi prepareCleanEnv pattern)
// ---------------------------------------------------------------------------

/**
 * Environment variable prefixes that interfere with child CLI processes
 * when the dashboard is launched from Electron, npm scripts, or similar
 * wrappers. These are stripped before spawning agent child processes.
 */
const INTERFERENCE_PREFIXES = [
  'npm_',
  'ELECTRON_',
];

const INTERFERENCE_KEYS = new Set([
  'NODE_CHANNEL_FD',
  'NODE_CHANNEL_SERIALIZATION_MODE',
]);

/**
 * Build a clean environment for spawning CLI child processes.
 * Strips Electron/npm lifecycle variables that can interfere with
 * child process behavior (e.g. NODE_OPTIONS set by Electron,
 * npm_lifecycle_event causing unexpected behavior in npx).
 */
export function cleanSpawnEnv(
  overrides?: Record<string, string | undefined>,
): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (INTERFERENCE_PREFIXES.some(p => key.startsWith(p))) continue;
    if (INTERFERENCE_KEYS.has(key)) continue;
    env[key] = value;
  }
  if (overrides) Object.assign(env, overrides);
  return env;
}
