import { Command } from 'commander';
import { registerServeCommand } from './commands/serve.js';
import { registerRunCommand } from './commands/run.js';
import { registerExtCommand } from './commands/ext.js';
import { registerToolCommand } from './commands/tool.js';
import { registerCliCommand } from './commands/cli.js';
import { registerInstallCommand } from './commands/install.js';
import { registerUninstallCommand } from './commands/uninstall.js';
import { registerViewCommand } from './commands/view.js';
import { registerStopCommand } from './commands/stop.js';
import { registerSpecCommand } from './commands/spec.js';
import { registerHooksCommand } from './commands/hooks.js';
import { registerCoordinateCommand } from './commands/coordinate.js';
import { registerLauncherCommand } from './commands/launcher.js';
import { registerDelegateCommand } from './commands/delegate.js';
import { registerMsgCommand } from './commands/msg.js';

const program = new Command();
const KNOWN_COMMANDS = new Set([
  'serve',
  'run',
  'ext',
  'tool',
  'cli',
  'install',
  'uninstall',
  'view',
  'stop',
  'spec',
  'hooks',
  'coordinate',
  'coord',
  'launcher',
  'delegate',
  'msg',
  '-h',
  '--help',
  '-V',
  '--version',
]);

program
  .name('maestro')
  .description('Workflow orchestration CLI with MCP support and extensible architecture')
  .version('0.1.1');

registerServeCommand(program);
registerRunCommand(program);
registerExtCommand(program);
registerToolCommand(program);
registerCliCommand(program);
registerInstallCommand(program);
registerUninstallCommand(program);
registerViewCommand(program);
registerStopCommand(program);
registerSpecCommand(program);
registerHooksCommand(program);
registerCoordinateCommand(program);
registerLauncherCommand(program);
registerDelegateCommand(program);
registerMsgCommand(program);

const rawArgs = process.argv.slice(2);
if (rawArgs.length > 0 && !KNOWN_COMMANDS.has(rawArgs[0])) {
  process.argv = [process.argv[0], process.argv[1], 'coordinate', 'run', ...rawArgs];
}

program.parse();
