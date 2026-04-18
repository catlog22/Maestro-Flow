// ---------------------------------------------------------------------------
// Shared version reader — reads version from package.json at project root
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

let cached: string | null = null;

/**
 * Return the maestro-flow package version from package.json.
 * Result is cached after the first call.
 */
export function getPackageVersion(): string {
  if (cached) return cached;
  // Walk up from this file until we find a package.json with "maestro" in it
  let dir = resolve(fileURLToPath(import.meta.url), '..');
  for (let i = 0; i < 8; i++) {
    const pkgPath = resolve(dir, 'package.json');
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      if (pkg.name === 'maestro-flow' || pkg.name === 'maestro') {
        cached = (pkg.version as string) ?? '0.0.0';
        return cached;
      }
    } catch { /* not found, keep going up */ }
    dir = resolve(dir, '..');
  }
  cached = '0.0.0';
  return cached;
}
