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
  // Compiled JS lives at dist/src/utils/get-version.js → 3 levels up to project root
  const pkgRoot = resolve(fileURLToPath(import.meta.url), '..', '..', '..');
  const pkg = JSON.parse(readFileSync(resolve(pkgRoot, 'package.json'), 'utf-8'));
  cached = (pkg.version as string) ?? '0.0.0';
  return cached;
}
