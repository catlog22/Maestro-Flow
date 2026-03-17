import type { Command } from 'commander';
import { loadConfig } from '../config/index.js';

export function registerServeCommand(program: Command): void {
  program
    .command('serve')
    .description('Start the maestro workflow server')
    .option('-p, --port <port>', 'server port', '3600')
    .option('--host <host>', 'server host', 'localhost')
    .action(async (opts) => {
      const config = loadConfig();
      const port = parseInt(opts.port, 10) || config.mcp.port;
      const host = opts.host || config.mcp.host;
      console.log(`maestro server starting on ${host}:${port}...`);
      // Server implementation will be added
    });
}
