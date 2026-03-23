// ---------------------------------------------------------------------------
// .env file loader — parse KEY=value pairs into env records
// ---------------------------------------------------------------------------

import { readFileSync, existsSync } from 'node:fs';
import { resolve, isAbsolute, join } from 'node:path';
import { homedir } from 'node:os';

/**
 * Parse .env file content into key-value pairs.
 * Supports: KEY=value, KEY="value", KEY='value', comments (#), empty lines.
 */
function parseEnvFile(content: string): Record<string, string> {
  const env: Record<string, string> = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.substring(0, eqIndex).trim();
    let value = trimmed.substring(eqIndex + 1).trim();

    // Remove surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key) env[key] = value;
  }

  return env;
}

/**
 * Load environment variables from a .env file path.
 * Supports ~ for home directory and relative paths.
 * Returns empty object if file not found or parse fails.
 */
export function loadEnvFile(envFilePath: string): Record<string, string> {
  try {
    let resolved = envFilePath;
    if (resolved.startsWith('~')) {
      resolved = join(homedir(), resolved.slice(1));
    }
    if (!isAbsolute(resolved)) {
      resolved = resolve(resolved);
    }
    if (!existsSync(resolved)) return {};

    const content = readFileSync(resolved, 'utf-8');
    return parseEnvFile(content);
  } catch {
    return {};
  }
}
