import { readFile } from 'node:fs/promises';

// ---------------------------------------------------------------------------
// Safe JSON file reader with retry logic
// ---------------------------------------------------------------------------

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 100;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Read and parse a JSON file with retry logic.
 *
 * - Returns `null` when the file does not exist (ENOENT).
 * - Retries up to 3 times with 100ms delay on JSON parse errors,
 *   which can occur when another process is mid-write.
 * - Throws after max retries on persistent parse failure.
 */
export async function readJsonSafe<T>(filePath: string): Promise<T | null> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const raw = await readFile(filePath, 'utf-8');
      return JSON.parse(raw) as T;
    } catch (err: unknown) {
      // File does not exist — not an error, just absent
      if (isEnoent(err)) {
        return null;
      }

      lastError = err;

      // Only retry on parse errors (partial write); not on permission errors etc.
      if (err instanceof SyntaxError && attempt < MAX_RETRIES) {
        await delay(RETRY_DELAY_MS);
        continue;
      }

      // Non-parse filesystem error — throw immediately
      if (!(err instanceof SyntaxError)) {
        throw err;
      }
    }
  }

  // Exhausted retries on parse error
  throw new Error(
    `Failed to parse JSON from ${filePath} after ${MAX_RETRIES} attempts: ${String(lastError)}`,
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isEnoent(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'ENOENT'
  );
}
