// ---------------------------------------------------------------------------
// `maestro stop` — stop the running maestro dashboard server
//
// Strategy (3-stage):
//   1. Try graceful shutdown via POST /api/shutdown
//   2. Find process by port via netstat and kill it
//   3. Force kill fallback (--force or when graceful fails)
// ---------------------------------------------------------------------------

import type { Command } from 'commander';
import { exec } from 'node:child_process';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PORT = 3001;
const HEALTH_TIMEOUT_MS = 2000;
const SHUTDOWN_TIMEOUT_MS = 5000;
const POST_SHUTDOWN_WAIT_MS = 500;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function execAsync(cmd: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: 10_000 }, (err, stdout, stderr) => {
      if (err) reject(err);
      else resolve({ stdout, stderr });
    });
  });
}

/**
 * Check if the dashboard server is running on the given port.
 */
async function checkHealth(port: number): Promise<{ status: string; workspace?: string } | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      return await res.json() as { status: string; workspace?: string };
    }
    return { status: 'up' };
  } catch {
    return null;
  }
}

/**
 * Request graceful shutdown via the API endpoint.
 * Returns true if the server acknowledged and stopped.
 */
async function requestApiShutdown(port: number): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SHUTDOWN_TIMEOUT_MS);
    const res = await fetch(`http://127.0.0.1:${port}/api/shutdown`, {
      method: 'POST',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) return false;

    // Wait for the process to actually exit
    await new Promise(r => setTimeout(r, POST_SHUTDOWN_WAIT_MS));

    // Verify it's gone
    const check = await checkHealth(port);
    return check === null; // null = no response = stopped
  } catch {
    // Connection refused or aborted = server already stopped
    return true;
  }
}

/**
 * Find the PID listening on the given port using platform-specific commands.
 */
async function findProcessOnPort(port: number): Promise<string | null> {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
      for (const line of stdout.split('\n')) {
        const parts = line.trim().split(/\s+/);
        // Format: TCP  0.0.0.0:3001  0.0.0.0:0  LISTENING  12345
        if (parts.length >= 5 && parts[3] === 'LISTENING') {
          const localAddr = parts[1] ?? '';
          if (localAddr.endsWith(`:${port}`)) {
            const pid = parts[4];
            if (pid && /^[1-9]\d*$/.test(pid)) return pid;
          }
        }
      }
    } else {
      // Unix/macOS: lsof
      const { stdout } = await execAsync(`lsof -i :${port} -t -sTCP:LISTEN`);
      const pid = stdout.trim().split('\n')[0]?.trim();
      if (pid && /^[1-9]\d*$/.test(pid)) return pid;
    }
  } catch {
    // Command failed — no process found
  }
  return null;
}

/**
 * Kill a process by PID using platform-specific commands.
 */
async function killProcess(pid: string, force: boolean): Promise<boolean> {
  try {
    if (process.platform === 'win32') {
      const flags = force ? '/T /F' : '/T';
      await execAsync(`taskkill /PID ${pid} ${flags}`);
    } else {
      const signal = force ? 'KILL' : 'TERM';
      await execAsync(`kill -${signal} ${pid}`);
    }
    return true;
  } catch {
    // Fallback for Windows: PowerShell
    if (process.platform === 'win32') {
      try {
        await execAsync(`powershell -Command "Stop-Process -Id ${pid} -Force"`);
        return true;
      } catch {
        // give up
      }
    }
    return false;
  }
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

export function registerStopCommand(program: Command): void {
  program
    .command('stop')
    .description('Stop the running maestro dashboard server')
    .option('-p, --port <port>', 'Server port', String(DEFAULT_PORT))
    .option('-f, --force', 'Force kill the process')
    .action(async (opts: { port: string; force?: boolean }) => {
      const port = parseInt(opts.port, 10) || DEFAULT_PORT;
      const force = opts.force ?? false;

      console.error('');
      console.error('  Maestro Stop');
      console.error('');

      // --- Stage 1: Check if server is running ---
      const health = await checkHealth(port);

      if (!health) {
        // Not running — try to find a process on the port anyway
        const pid = await findProcessOnPort(port);
        if (pid) {
          console.error(`  No server response on port ${port}, but found PID ${pid}.`);
          if (force) {
            console.error(`  Force killing PID ${pid}...`);
            const killed = await killProcess(pid, true);
            console.error(killed ? '  Process killed.' : '  Failed to kill process.');
          } else {
            console.error('  Use --force to kill it.');
          }
        } else {
          console.error(`  No server running on port ${port}.`);
        }
        console.error('');
        return;
      }

      console.error(`  Server running on port ${port}`);
      if (health.workspace) {
        console.error(`  Workspace: ${health.workspace}`);
      }

      // --- Stage 2: Try graceful API shutdown ---
      if (!force) {
        console.error('  Requesting graceful shutdown...');
        const stopped = await requestApiShutdown(port);
        if (stopped) {
          console.error('  Server stopped.');
          console.error('');
          return;
        }
        console.error('  Graceful shutdown did not complete, falling back to process kill...');
      }

      // --- Stage 3: Kill process by port ---
      const pid = await findProcessOnPort(port);
      if (!pid) {
        // Check again — server might have stopped between stages
        const recheck = await checkHealth(port);
        if (!recheck) {
          console.error('  Server stopped.');
          console.error('');
          return;
        }
        console.error('  Could not find server PID. Try manually stopping the process.');
        console.error('');
        return;
      }

      console.error(`  Killing PID ${pid}...`);
      const killed = await killProcess(pid, true);
      if (killed) {
        // Verify
        await new Promise(r => setTimeout(r, 500));
        const recheck = await checkHealth(port);
        console.error(recheck ? '  Warning: Server may still be running.' : '  Server stopped.');
      } else {
        console.error('  Failed to kill process. Try stopping it manually.');
      }

      console.error('');
    });
}
