// ---------------------------------------------------------------------------
// `maestro agent-msg` — CLI wrapper over team_msg handler
// ---------------------------------------------------------------------------

import type { Command } from 'commander';
import { handler } from '../tools/team-msg.js';

function renderResult(result: Record<string, unknown>): void {
  if (result.formatted && typeof result.formatted === 'string') {
    console.log(result.formatted);
  } else if (result.message && typeof result.message === 'string') {
    console.log(result.message);
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

async function run(params: Record<string, unknown>): Promise<void> {
  const result = await handler(params);
  if (!result.success) {
    console.error(`Error: ${result.error}`);
    process.exit(1);
  }
  renderResult(result.result as Record<string, unknown>);
}

export function registerMsgCommand(program: Command): void {
  const msg = program
    .command('agent-msg')
    .alias('msg')
    .description('Agent team message bus — send, list, and manage agent messages');

  // ---- send ----------------------------------------------------------------

  msg
    .command('send <message>')
    .description('Send a message (log operation)')
    .requiredOption('-s, --session <id>', 'Session ID')
    .requiredOption('--from <role>', 'Sender role')
    .option('--to <role>', 'Recipient role', 'coordinator')
    .option('--type <type>', 'Message type', 'message')
    .option('--summary <text>', 'One-line summary')
    .action(async (message: string, opts: {
      session: string;
      from: string;
      to: string;
      type: string;
      summary?: string;
    }) => {
      await run({
        operation: 'log',
        session_id: opts.session,
        from: opts.from,
        to: opts.to,
        type: opts.type,
        summary: opts.summary ?? message,
        data: { text: message },
      });
    });

  // ---- list ----------------------------------------------------------------

  msg
    .command('list')
    .description('List recent messages')
    .requiredOption('-s, --session <id>', 'Session ID')
    .option('--from <role>', 'Filter by sender')
    .option('--to <role>', 'Filter by recipient')
    .option('--type <type>', 'Filter by message type')
    .option('--last <n>', 'Number of messages', '20')
    .action(async (opts: {
      session: string;
      from?: string;
      to?: string;
      type?: string;
      last: string;
    }) => {
      await run({
        operation: 'list',
        session_id: opts.session,
        from: opts.from,
        to: opts.to,
        type: opts.type,
        last: parseInt(opts.last, 10),
      });
    });

  // ---- status --------------------------------------------------------------

  msg
    .command('status')
    .description('Summarize team member activity')
    .requiredOption('-s, --session <id>', 'Session ID')
    .action(async (opts: { session: string }) => {
      await run({ operation: 'status', session_id: opts.session });
    });

  // ---- broadcast -----------------------------------------------------------

  msg
    .command('broadcast <message>')
    .description('Broadcast a message to all team members')
    .requiredOption('-s, --session <id>', 'Session ID')
    .requiredOption('--from <role>', 'Sender role')
    .option('--type <type>', 'Message type', 'message')
    .option('--summary <text>', 'One-line summary')
    .action(async (message: string, opts: {
      session: string;
      from: string;
      type: string;
      summary?: string;
    }) => {
      await run({
        operation: 'broadcast',
        session_id: opts.session,
        from: opts.from,
        type: opts.type,
        summary: opts.summary ?? message,
        data: { text: message },
      });
    });

  // ---- read ----------------------------------------------------------------

  msg
    .command('read <msgId>')
    .description('Read a specific message by ID')
    .requiredOption('-s, --session <id>', 'Session ID')
    .action(async (msgId: string, opts: { session: string }) => {
      await run({ operation: 'read', session_id: opts.session, id: msgId });
    });

  // ---- clear ---------------------------------------------------------------

  msg
    .command('clear')
    .description('Clear all messages for a session')
    .requiredOption('-s, --session <id>', 'Session ID')
    .action(async (opts: { session: string }) => {
      await run({ operation: 'clear', session_id: opts.session });
    });
}
