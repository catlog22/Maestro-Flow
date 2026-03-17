import type { Command } from 'commander';
import { ToolRegistry } from '../core/tool-registry.js';
import { registerBuiltinTools } from '../tools/index.js';

export function registerToolCommand(program: Command): void {
  const tool = program
    .command('tool')
    .description('Interact with registered tools');

  tool
    .command('list')
    .description('List all available tools')
    .action(() => {
      const registry = new ToolRegistry();
      registerBuiltinTools(registry);
      const tools = registry.list();
      console.log('Available tools:');
      tools.forEach((t) => console.log(`  ${t.name} — ${t.description}`));
    });

  tool
    .command('exec <name>')
    .description('Execute a tool with JSON input')
    .argument('[input]', 'JSON input string', '{}')
    .action(async (name, input) => {
      const registry = new ToolRegistry();
      registerBuiltinTools(registry);
      const parsed = JSON.parse(input);
      const result = await registry.execute(name, parsed);
      console.log(JSON.stringify(result, null, 2));
    });
}
