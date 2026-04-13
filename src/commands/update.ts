// ---------------------------------------------------------------------------
// `maestro update` — check for updates and optionally install the latest version
//
// Strategy:
//   1. Fetch latest version from npm registry
//   2. Compare with current installed version
//   3. Prompt user to install if update is available
// ---------------------------------------------------------------------------

import type { Command } from 'commander';
import { exec } from 'node:child_process';
import { getPackageVersion } from '../utils/get-version.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PACKAGE_NAME = 'maestro-flow';
const REGISTRY_URL = `https://registry.npmjs.org/${PACKAGE_NAME}/latest`;
const FETCH_TIMEOUT_MS = 8000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fetch the latest published version from the npm registry.
 */
async function fetchLatestVersion(): Promise<{ version: string; publishedAt: string } | null> {
  try {
    const res = await fetch(REGISTRY_URL, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    return {
      version: (data.version as string) ?? '0.0.0',
      publishedAt: (data.time as string) ?? '',
    };
  } catch {
    return null;
  }
}

/**
 * Compare two semver strings (major.minor.patch).
 * Returns 1 if a > b, -1 if a < b, 0 if equal.
 */
function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

function execAsync(cmd: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: 120_000 }, (err, stdout, stderr) => {
      if (err) reject(err);
      else resolve({ stdout, stderr });
    });
  });
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

export function registerUpdateCommand(program: Command): void {
  program
    .command('update')
    .description('Check for updates and install the latest version')
    .option('--check', 'Only check for updates, do not install')
    .action(async (opts: { check?: boolean }) => {
      console.error('');
      console.error('  Maestro Update');
      console.error('');

      const current = getPackageVersion();
      console.error(`  Current version:  ${current}`);

      // Fetch latest from npm
      console.error('  Checking npm registry...');
      const latest = await fetchLatestVersion();

      if (!latest) {
        console.error('  Could not reach the npm registry. Check your network connection.');
        console.error('');
        return;
      }

      console.error(`  Latest version:   ${latest.version}`);

      const cmp = compareSemver(latest.version, current);

      if (cmp <= 0) {
        console.error('');
        console.error('  You are on the latest version.');
        console.error('');
        return;
      }

      console.error('');
      console.error(`  Update available: ${current} → ${latest.version}`);

      if (opts.check) {
        console.error('');
        console.error(`  Run \`maestro update\` to install.`);
        console.error('');
        return;
      }

      // Prompt for confirmation
      const { confirm } = await import('@inquirer/prompts');
      const shouldInstall = await confirm({
        message: `Install ${PACKAGE_NAME}@${latest.version}?`,
        default: true,
      });

      if (!shouldInstall) {
        console.error('  Update cancelled.');
        console.error('');
        return;
      }

      console.error('');
      console.error(`  Installing ${PACKAGE_NAME}@${latest.version}...`);
      console.error('');

      try {
        const { stdout, stderr } = await execAsync(`npm install -g ${PACKAGE_NAME}@${latest.version}`);
        if (stdout.trim()) console.error(stdout.trim());
        if (stderr.trim()) console.error(stderr.trim());
        console.error('');
        console.error('  Update complete!');
      } catch (err) {
        console.error('  Installation failed.');
        if (err instanceof Error) {
          console.error(`  ${err.message}`);
        }
        console.error('');
        console.error(`  You can try manually: npm install -g ${PACKAGE_NAME}@${latest.version}`);
      }

      console.error('');
    });
}
