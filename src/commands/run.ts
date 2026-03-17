import type { Command } from 'commander';

export function registerRunCommand(program: Command): void {
  program
    .command('run <workflow>')
    .description('Execute a workflow by name')
    .option('-c, --config <path>', 'workflow config file')
    .option('--dry-run', 'show what would be executed without running')
    .action(async (workflow, opts) => {
      console.log(`Running workflow: ${workflow}`);
      if (opts.dryRun) {
        console.log('(dry-run mode)');
      }
      // Workflow execution will be implemented
    });
}
