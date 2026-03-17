import type { Command } from 'commander';
import { paths } from '../config/paths.js';
import { ToolRegistry } from '../core/tool-registry.js';
import { ExtensionLoader } from '../core/extension-loader.js';
import { registerBuiltinTools } from '../tools/index.js';

export function registerExtCommand(program: Command): void {
  const ext = program
    .command('ext')
    .description('Manage extensions');

  ext
    .command('list')
    .description('List installed extensions')
    .action(async () => {
      const registry = new ToolRegistry();
      registerBuiltinTools(registry);
      const loader = new ExtensionLoader(registry);
      await loader.loadFromDir(paths.extensions);
      const loaded = loader.listLoaded();
      if (loaded.length === 0) {
        console.log('No extensions installed.');
      } else {
        console.log('Installed extensions:');
        loaded.forEach((name) => console.log(`  - ${name}`));
      }
      await loader.unloadAll();
    });
}
