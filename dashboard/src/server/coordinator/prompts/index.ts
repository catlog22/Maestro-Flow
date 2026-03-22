// ---------------------------------------------------------------------------
// Prompt loader — reads .md prompt files with caching
// ---------------------------------------------------------------------------

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cache = new Map<string, string>();

export async function loadPrompt(name: string): Promise<string> {
  if (cache.has(name)) return cache.get(name)!;
  const content = await readFile(join(__dirname, `${name}.md`), 'utf-8');
  cache.set(name, content);
  return content;
}
