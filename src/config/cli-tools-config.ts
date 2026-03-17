// ---------------------------------------------------------------------------
// CLI Tools configuration loader
// Reads ~/.maestro/cli-tools.json for tool selection and model routing.
// ---------------------------------------------------------------------------

import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToolEntry {
  enabled: boolean;
  primaryModel: string;
  secondaryModel?: string;
  tags: string[];
  type: string;
}

export interface CliToolsConfig {
  version: string;
  tools: Record<string, ToolEntry>;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: CliToolsConfig = {
  version: '1.0.0',
  tools: {},
};

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Load CLI tools configuration from ~/.maestro/cli-tools.json.
 * Returns a default empty config if the file does not exist or is invalid.
 */
export async function loadCliToolsConfig(): Promise<CliToolsConfig> {
  const configPath = join(homedir(), '.maestro', 'cli-tools.json');
  try {
    const raw = await readFile(configPath, 'utf-8');
    return JSON.parse(raw) as CliToolsConfig;
  } catch {
    return DEFAULT_CONFIG;
  }
}

// ---------------------------------------------------------------------------
// Tool selection
// ---------------------------------------------------------------------------

export interface SelectedTool {
  name: string;
  entry: ToolEntry;
}

/**
 * Select a tool by explicit name or fall back to the first enabled tool.
 * Returns undefined when no tool can be resolved.
 */
export function selectTool(
  name: string | undefined,
  config: CliToolsConfig,
): SelectedTool | undefined {
  // Exact match by name
  if (name && config.tools[name]?.enabled) {
    return { name, entry: config.tools[name] };
  }

  // Fallback: first enabled tool in config order
  for (const [toolName, entry] of Object.entries(config.tools)) {
    if (entry.enabled) {
      return { name: toolName, entry };
    }
  }

  return undefined;
}
