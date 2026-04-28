/**
 * Spec Command — CLI endpoint for project spec management
 *
 * Subcommands: load, list, init, status
 */

import type { Command } from 'commander';

const VALID_SCOPES = ['project', 'global', 'team', 'personal'] as const;
const SCOPE_LABELS: Record<string, string> = {
  project: 'Project specs',
  global: 'Global specs',
  team: 'Team specs',
  personal: 'Personal specs',
};

/** Resolve uid for scopes that need it (personal). */
async function resolveUid(opts: { uid?: string }): Promise<string | undefined> {
  if (opts.uid) return opts.uid;
  try {
    const { resolveSelf } = await import('../tools/team-members.js');
    const self = resolveSelf();
    return self?.uid;
  } catch {
    return undefined;
  }
}

function validateScope(value: string | undefined): import('../tools/spec-loader.js').SpecScope {
  if (!value) return 'project';
  if (!VALID_SCOPES.includes(value as typeof VALID_SCOPES[number])) {
    console.error(`Error: --scope must be one of ${VALID_SCOPES.join(', ')} (got "${value}")`);
    process.exit(1);
  }
  return value as import('../tools/spec-loader.js').SpecScope;
}

export function registerSpecCommand(program: Command): void {
  const spec = program
    .command('spec')
    .description('Project spec management (init, load, list, status)');

  // ── load ──────────────────────────────────────────────────────────────
  spec
    .command('load')
    .description('Load specs matching category')
    .option('--category <stage>', 'Filter by category: coding|arch|quality|debug|test|review|learning')
    .option('--keyword <word>', 'Filter entries by keyword')
    .option('--scope <scope>', 'Spec scope: project|global|team|personal (default: project)')
    .option('--uid <uid>', 'User id for personal scope (auto-detected from git if omitted)')
    .option('--stdin', 'Read input from stdin (Hook mode)')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const { loadSpecs } = await import('../tools/spec-loader.js');

      let projectPath = process.cwd();
      let keyword = opts.keyword as string | undefined;

      if (opts.stdin) {
        try {
          const raw = await readStdin();
          if (raw) {
            const stdinData = JSON.parse(raw);
            if (stdinData?.cwd && typeof stdinData.cwd === 'string') {
              projectPath = stdinData.cwd;
            }
            if (stdinData?.keyword && typeof stdinData.keyword === 'string') {
              keyword = stdinData.keyword;
            }
          }
        } catch {
          process.stdout.write(JSON.stringify({ continue: true }));
          process.exit(0);
        }
      }

      const scope = validateScope(opts.scope);
      const uid = await resolveUid(opts);

      if (scope === 'personal' && !uid) {
        console.error('Error: personal scope requires --uid or team membership (maestro collab join).');
        process.exit(1);
      }

      const result = loadSpecs(projectPath, opts.category, uid, keyword, scope);

      if (opts.stdin) {
        if (result.content) {
          const wrapped = `<project-specs>\n${result.content}\n</project-specs>`;
          process.stdout.write(JSON.stringify({ continue: true, systemMessage: wrapped }));
        } else {
          process.stdout.write(JSON.stringify({ continue: true }));
        }
        process.exit(0);
      }

      if (opts.json) {
        console.log(JSON.stringify({
          specs: result.matchedSpecs,
          totalLoaded: result.totalLoaded,
          content: result.content,
        }, null, 2));
      } else {
        console.log(result.content || '(No specs found)');
      }
    });

  // ── list ──────────────────────────────────────────────────────────────
  spec
    .command('list')
    .alias('ls')
    .description('List spec files for a given scope')
    .option('--scope <scope>', 'Spec scope: project|global|team|personal (default: project)')
    .option('--uid <uid>', 'User id for personal scope')
    .action(async (opts) => {
      const { existsSync, readdirSync } = await import('node:fs');
      const { resolveSpecDir } = await import('../tools/spec-loader.js');

      const scope = validateScope(opts.scope);
      const uid = await resolveUid(opts);

      if (scope === 'personal' && !uid) {
        console.error('Error: personal scope requires --uid or team membership.');
        process.exit(1);
      }

      const specsDir = resolveSpecDir(process.cwd(), scope, uid);
      const label = SCOPE_LABELS[scope];

      if (!existsSync(specsDir)) {
        console.log(`No ${label.toLowerCase()} directory. Run "maestro spec init --scope ${scope}" to create.`);
        return;
      }

      const files = readdirSync(specsDir).filter(f => f.endsWith('.md'));
      if (files.length === 0) {
        console.log(`No ${label.toLowerCase()} files found.`);
        return;
      }

      console.log(`${label} (${files.length} files)  [${specsDir}]\n`);
      for (const file of files) {
        console.log(`  ${file}`);
      }
    });

  // ── init ──────────────────────────────────────────────────────────────
  spec
    .command('init')
    .description('Initialize spec system with seed documents')
    .option('--scope <scope>', 'Spec scope: project|global|team|personal (default: project)')
    .option('--uid <uid>', 'User id for personal scope')
    .action(async (opts) => {
      const { initSpecSystem } = await import('../tools/spec-init.js');

      const scope = validateScope(opts.scope);
      const uid = await resolveUid(opts);

      if (scope === 'personal' && !uid) {
        console.error('Error: personal scope requires --uid or team membership.');
        process.exit(1);
      }

      const label = SCOPE_LABELS[scope];
      console.log(`Initializing ${label.toLowerCase()}...`);
      const result = initSpecSystem(process.cwd(), scope, uid);

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
      }
    });

  // ── status ────────────────────────────────────────────────────────────
  spec
    .command('status')
    .description('Show spec system status')
    .option('--scope <scope>', 'Spec scope: project|global|team|personal (default: project)')
    .option('--uid <uid>', 'User id for personal scope')
    .action(async (opts) => {
      const { existsSync, readdirSync, readFileSync } = await import('node:fs');
      const { join } = await import('node:path');
      const { resolveSpecDir } = await import('../tools/spec-loader.js');

      const scope = validateScope(opts.scope);
      const uid = await resolveUid(opts);

      if (scope === 'personal' && !uid) {
        console.error('Error: personal scope requires --uid or team membership.');
        process.exit(1);
      }

      const specsDir = resolveSpecDir(process.cwd(), scope, uid);
      const label = SCOPE_LABELS[scope];
      const dirExists = existsSync(specsDir);

      if (!dirExists) {
        console.log(`${label} directory: missing`);
        console.log(`Run "maestro spec init --scope ${scope}" to initialize.`);
        return;
      }

      const files = readdirSync(specsDir).filter(f => f.endsWith('.md'));
      console.log(`${label} System Status\n`);
      console.log(`  Directory: OK (${specsDir})`);
      console.log(`  Files: ${files.length}\n`);

      for (const file of files) {
        const size = readFileSync(join(specsDir, file), 'utf-8').length;
        console.log(`    ${file}  (${size} chars)`);
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
