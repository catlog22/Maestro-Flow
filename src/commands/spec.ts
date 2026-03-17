/**
 * Spec Command — CLI endpoint for project spec management
 *
 * Subcommands: load, list, init, rebuild, status
 * Pattern: cli.ts register -> commands/spec.ts dispatch -> tools/spec-*.ts execute
 */

import type { Command } from 'commander';

export function registerSpecCommand(program: Command): void {
  const spec = program
    .command('spec')
    .description('Project spec management (init, load, list, rebuild, status)');

  // ── load ──────────────────────────────────────────────────────────────
  spec
    .command('load')
    .description('Load specs matching category/keywords')
    .option('--category <stage>', 'Filter by workflow stage: general|exploration|planning|execution|debug|test|review|validation')
    .option('--keywords <text>', 'Keywords for spec matching (space or comma separated)')
    .option('--stdin', 'Read input from stdin (Hook mode)')
    .option('--json', 'Output as JSON')
    .option('--max-length <n>', 'Max content length', '8000')
    .action(async (opts) => {
      const { loadSpecs } = await import('../tools/spec-loader.js');

      let projectPath = process.cwd();
      let stdinData: Record<string, unknown> | undefined;

      if (opts.stdin) {
        try {
          const raw = await readStdin();
          if (raw) {
            stdinData = JSON.parse(raw);
            if (stdinData?.cwd && typeof stdinData.cwd === 'string') {
              projectPath = stdinData.cwd;
            }
          }
        } catch {
          process.stdout.write(JSON.stringify({ continue: true }));
          process.exit(0);
        }
      }

      const keywords = opts.keywords
        ? String(opts.keywords).split(/[\s,]+/).filter(Boolean)
        : undefined;

      const result = loadSpecs({
        projectPath,
        category: opts.category,
        keywords,
        outputFormat: opts.stdin ? 'hook' : 'cli',
        stdinData,
        maxLength: parseInt(opts.maxLength, 10) || 8000,
      });

      if (opts.stdin) {
        process.stdout.write(result.content);
        process.exit(0);
      }

      if (opts.json) {
        console.log(JSON.stringify({
          specs: result.matchedSpecs,
          totalLoaded: result.totalLoaded,
          contentLength: result.contentLength,
          content: result.content,
        }, null, 2));
      } else {
        console.log(result.content);
      }
    });

  // ── list ──────────────────────────────────────────────────────────────
  spec
    .command('list')
    .alias('ls')
    .description('List all indexed specs with readMode and priority')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const { getSpecIndex } = await import('../tools/spec-index-builder.js');
      const index = getSpecIndex(process.cwd());

      if (opts.json) {
        console.log(JSON.stringify(index.entries, null, 2));
        return;
      }

      if (index.entries.length === 0) {
        console.log('No specs found. Run "maestro spec init" to create seed documents.');
        return;
      }

      console.log(`Specs (${index.entries.length} total)\n`);
      for (const entry of index.entries) {
        const mode = entry.readMode === 'required' ? 'required' : 'optional';
        const kw = entry.keywords.length > 0 ? ` (${entry.keywords.join(', ')})` : '';
        console.log(`  ${entry.title}  [${mode}]  ${entry.priority}  ${entry.category}${kw}`);
      }
    });

  // ── init ──────────────────────────────────────────────────────────────
  spec
    .command('init')
    .description('Initialize spec system with seed documents')
    .action(async () => {
      const { initSpecSystem } = await import('../tools/spec-init.js');

      console.log('Initializing spec system...');
      const result = initSpecSystem(process.cwd());

      if (result.directories.length > 0) {
        console.log('\nDirectories created:');
        for (const dir of result.directories) console.log(`  + ${dir}`);
      }

      if (result.created.length > 0) {
        console.log('\nSeed files created:');
        for (const file of result.created) console.log(`  + ${file}`);
      }

      if (result.skipped.length > 0) {
        console.log('\nSkipped (already exist):');
        for (const file of result.skipped) console.log(`  - ${file}`);
      }

      if (result.directories.length === 0 && result.created.length === 0) {
        console.log('\nSpec system already initialized. No changes made.');
      } else {
        console.log('\nSpec system initialized. Run "maestro spec rebuild" to build index.');
      }
    });

  // ── rebuild ───────────────────────────────────────────────────────────
  spec
    .command('rebuild')
    .description('Rebuild spec index cache')
    .action(async () => {
      const { buildSpecIndex, writeIndexCache } = await import('../tools/spec-index-builder.js');

      console.log('Rebuilding spec index...');
      const index = buildSpecIndex(process.cwd());
      writeIndexCache(process.cwd(), index);
      console.log(`  ${index.entries.length} entries indexed`);
      console.log('Index rebuild complete.');
    });

  // ── status ────────────────────────────────────────────────────────────
  spec
    .command('status')
    .description('Show spec system status')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const { readCachedIndex, getSpecsDir } = await import('../tools/spec-index-builder.js');
      const { existsSync } = await import('node:fs');

      const projectPath = process.cwd();
      const specsDir = getSpecsDir(projectPath);
      const dirExists = existsSync(specsDir);
      const cached = readCachedIndex(projectPath);
      const entries = cached?.entries ?? [];
      const required = entries.filter(e => e.readMode === 'required').length;
      const optional = entries.filter(e => e.readMode === 'optional').length;

      const stats = {
        directory: dirExists ? 'OK' : 'missing',
        indexed: cached !== null,
        built_at: cached?.built_at ?? null,
        total: entries.length,
        required,
        optional,
        entries: entries.map(e => ({
          title: e.title,
          readMode: e.readMode,
          priority: e.priority,
          category: e.category,
          contentLength: e.contentLength,
        })),
      };

      if (opts.json) {
        console.log(JSON.stringify(stats, null, 2));
        return;
      }

      console.log('Spec System Status\n');
      console.log(`  Directory: ${stats.directory}`);
      console.log(`  Index: ${stats.indexed ? 'cached' : 'not built'}${stats.built_at ? ` (${new Date(stats.built_at).toLocaleString()})` : ''}`);
      console.log(`  Specs: ${stats.total} total (${stats.required} required, ${stats.optional} optional)\n`);

      for (const e of stats.entries) {
        console.log(`    ${e.title}  [${e.readMode}]  ${e.priority}  ${e.category}  (${e.contentLength} chars)`);
      }
    });
}

// ── Helpers ─────────────────────────────────────────────────────────────

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('readable', () => {
      let chunk;
      while ((chunk = process.stdin.read()) !== null) {
        data += chunk as string;
      }
    });
    process.stdin.on('end', () => resolve(data));
    if (process.stdin.isTTY) resolve('');
  });
}
