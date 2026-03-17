import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Dashboard configuration
// ---------------------------------------------------------------------------

export interface DashboardConfig {
  port: number;
  host: string;
  debounce_ms: number;
  polling_fallback: boolean;
  heartbeat_interval_ms: number;
  max_connections: number;
  workflow_root: string;
}

const DEFAULT_CONFIG: DashboardConfig = {
  port: 3001,
  host: '127.0.0.1',
  debounce_ms: 150,
  polling_fallback: false,
  heartbeat_interval_ms: 30_000,
  max_connections: 10,
  // The dashboard lives in dashboard/ so the project .workflow is one level up.
  // Override via WORKFLOW_ROOT env var or dashboard.workflow_root in config.json.
  workflow_root: '../.workflow',
};

/**
 * Load dashboard configuration from .workflow/config.json `dashboard` section.
 * Falls back to defaults when file is missing or section is absent.
 */
export async function loadConfig(cwd: string = process.cwd()): Promise<DashboardConfig> {
  const configPath = resolve(cwd, '.workflow', 'config.json');

  try {
    const raw = await readFile(configPath, 'utf-8');
    const json = JSON.parse(raw) as Record<string, unknown>;
    const section = (json['dashboard'] ?? {}) as Partial<DashboardConfig>;

    return applyEnvOverrides({ ...DEFAULT_CONFIG, ...section });
  } catch {
    // Config file missing or unreadable — use defaults
    return applyEnvOverrides({ ...DEFAULT_CONFIG });
  }
}

/** Environment variable overrides for CLI integration (e.g. `maestro view --port`). */
function applyEnvOverrides(config: DashboardConfig): DashboardConfig {
  if (process.env.PORT) {
    const p = parseInt(process.env.PORT, 10);
    if (!isNaN(p)) config.port = p;
  }
  if (process.env.HOST) {
    config.host = process.env.HOST;
  }
  if (process.env.WORKFLOW_ROOT) {
    config.workflow_root = process.env.WORKFLOW_ROOT;
  }
  return config;
}
