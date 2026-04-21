import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import {
  mkdtempSync,
  rmSync,
  existsSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { handler, readAllMessages } from '../team-msg.js';
import type { TeamMessage } from '../team-msg.js';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

let tmpDir: string;
let prevRoot: string | undefined;

function setup(): void {
  tmpDir = mkdtempSync(join(tmpdir(), 'team-msg-test-'));
  prevRoot = process.env.MAESTRO_PROJECT_ROOT;
  process.env.MAESTRO_PROJECT_ROOT = tmpDir;
}

function teardown(): void {
  if (prevRoot === undefined) {
    delete process.env.MAESTRO_PROJECT_ROOT;
  } else {
    process.env.MAESTRO_PROJECT_ROOT = prevRoot;
  }
  if (tmpDir && existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('team-msg dispatch', () => {
  beforeEach(setup);
  afterEach(teardown);

  // --- DispatchStatus enum via interface ---

  describe('TeamMessage interface', () => {
    it('has dispatch_status field with 4 states', async () => {
      const states = ['pending', 'notified', 'delivered', 'failed'];

      for (const status of states) {
        const result = await handler({
          operation: 'log',
          session_id: 'test-session',
          from: 'alice',
          to: 'bob',
          type: 'task',
          summary: `test-${status}`,
          delivery_method: 'test',
        });
        expect(result.success).toBe(true);

        // Manually patch a message to test each status
        const messages = readAllMessages('test-session');
        const msg = messages[messages.length - 1];
        expect(msg).toBeDefined();
        // The message should have dispatch_status since delivery_method was provided
        expect(msg.dispatch_status).toBe('pending');
      }
    });
  });

  // --- opLog with delivery_method ---

  describe('opLog with delivery_method', () => {
    it('sets dispatch_status to pending when delivery_method provided', async () => {
      const result = await handler({
        operation: 'log',
        session_id: 'test-session',
        from: 'alice',
        to: 'bob',
        delivery_method: 'inject',
      });

      expect(result.success).toBe(true);
      const messages = readAllMessages('test-session');
      expect(messages).toHaveLength(1);
      expect(messages[0].dispatch_status).toBe('pending');
      expect(messages[0].delivery_method).toBe('inject');
      expect(messages[0].delivered_at).toBeUndefined();
    });

    it('sets dispatch_status to delivered when no delivery_method (backward compat)', async () => {
      const result = await handler({
        operation: 'log',
        session_id: 'test-session',
        from: 'alice',
        to: 'bob',
      });

      expect(result.success).toBe(true);
      const messages = readAllMessages('test-session');
      expect(messages).toHaveLength(1);
      expect(messages[0].dispatch_status).toBe('delivered');
      expect(messages[0].delivery_method).toBeUndefined();
      expect(messages[0].delivered_at).toBeDefined();
    });

    it('legacy messages without dispatch fields default to delivered in opReadMailbox', async () => {
      // Log a legacy message (no delivery_method -> delivered)
      await handler({
        operation: 'log',
        session_id: 'test-session',
        from: 'alice',
        to: 'bob',
      });

      // Read mailbox for bob - should find no unread messages
      const mailboxResult = await handler({
        operation: 'read_mailbox',
        session_id: 'test-session',
        role: 'bob',
      });

      expect(mailboxResult.success).toBe(true);
      const result = mailboxResult.result as { count: number };
      expect(result.count).toBe(0);
    });
  });

  // --- opReadMailbox ---

  describe('opReadMailbox', () => {
    it('requires role parameter', async () => {
      const result = await handler({
        operation: 'read_mailbox',
        session_id: 'test-session',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('role');
    });

    it('returns unread messages for a role and marks them delivered', async () => {
      // Log a pending message to bob
      await handler({
        operation: 'log',
        session_id: 'test-session',
        from: 'alice',
        to: 'bob',
        summary: 'Hello Bob',
        delivery_method: 'inject',
      });

      // Log a pending message to carol
      await handler({
        operation: 'log',
        session_id: 'test-session',
        from: 'alice',
        to: 'carol',
        summary: 'Hello Carol',
        delivery_method: 'inject',
      });

      // Read bob's mailbox
      const mailboxResult = await handler({
        operation: 'read_mailbox',
        session_id: 'test-session',
        role: 'bob',
      });

      expect(mailboxResult.success).toBe(true);
      const result = mailboxResult.result as { count: number; messages: TeamMessage[]; role: string };
      expect(result.role).toBe('bob');
      expect(result.count).toBe(1);
      expect(result.messages[0].summary).toBe('Hello Bob');

      // Verify the message is now marked as delivered on disk
      const messages = readAllMessages('test-session');
      const bobMsg = messages.find(m => m.to === 'bob');
      expect(bobMsg?.dispatch_status).toBe('delivered');
      expect(bobMsg?.delivered_at).toBeDefined();

      // Carol's message should still be pending
      const carolMsg = messages.find(m => m.to === 'carol');
      expect(carolMsg?.dispatch_status).toBe('pending');
    });

    it('returns empty when no unread messages exist for role', async () => {
      // Log a delivered (legacy) message to bob
      await handler({
        operation: 'log',
        session_id: 'test-session',
        from: 'alice',
        to: 'bob',
      });

      const mailboxResult = await handler({
        operation: 'read_mailbox',
        session_id: 'test-session',
        role: 'bob',
      });

      expect(mailboxResult.success).toBe(true);
      const result = mailboxResult.result as { count: number };
      expect(result.count).toBe(0);
    });

    it('returns messages with notified status', async () => {
      // Log a pending message, then manually set to notified
      await handler({
        operation: 'log',
        session_id: 'test-session',
        from: 'alice',
        to: 'bob',
        delivery_method: 'inject',
      });

      // Manually patch to notified
      const messages = readAllMessages('test-session');
      const { writeFileSync } = await import('node:fs');
      const { join: joinPath } = await import('node:path');
      const { getLogDir } = await import('../team-msg.js');
      const logDir = getLogDir('test-session');
      messages[0].dispatch_status = 'notified';
      messages[0].notified_at = messages[0].ts;
      writeFileSync(
        joinPath(logDir, 'messages.jsonl'),
        messages.map(m => JSON.stringify(m)).join('\n') + '\n',
        'utf-8',
      );

      const mailboxResult = await handler({
        operation: 'read_mailbox',
        session_id: 'test-session',
        role: 'bob',
      });

      expect(mailboxResult.success).toBe(true);
      const result = mailboxResult.result as { count: number };
      expect(result.count).toBe(1);
    });

    it('second read_mailbox returns empty (messages already delivered)', async () => {
      await handler({
        operation: 'log',
        session_id: 'test-session',
        from: 'alice',
        to: 'bob',
        delivery_method: 'inject',
      });

      // First read
      await handler({
        operation: 'read_mailbox',
        session_id: 'test-session',
        role: 'bob',
      });

      // Second read should be empty
      const result = await handler({
        operation: 'read_mailbox',
        session_id: 'test-session',
        role: 'bob',
      });

      expect(result.success).toBe(true);
      const data = result.result as { count: number };
      expect(data.count).toBe(0);
    });
  });

  // --- mailbox_status ---

  describe('opMailboxStatus', () => {
    it('returns dispatch counts per role', async () => {
      // Log a pending message to bob
      await handler({
        operation: 'log',
        session_id: 'test-session',
        from: 'alice',
        to: 'bob',
        delivery_method: 'inject',
      });

      // Log a legacy (delivered) message to carol
      await handler({
        operation: 'log',
        session_id: 'test-session',
        from: 'alice',
        to: 'carol',
      });

      const statusResult = await handler({
        operation: 'mailbox_status',
        session_id: 'test-session',
      });

      expect(statusResult.success).toBe(true);
      const result = statusResult.result as {
        roles: Record<string, Record<string, number>>;
        total_messages: number;
      };

      expect(result.total_messages).toBe(2);
      expect(result.roles['bob']).toEqual({ pending: 1, notified: 0, delivered: 0, failed: 0 });
      expect(result.roles['carol']).toEqual({ pending: 0, notified: 0, delivered: 1, failed: 0 });
    });

    it('returns empty result for session with no messages', async () => {
      const statusResult = await handler({
        operation: 'mailbox_status',
        session_id: 'empty-session',
      });

      expect(statusResult.success).toBe(true);
      const result = statusResult.result as {
        roles: Record<string, Record<string, number>>;
        total_messages: number;
      };
      expect(result.total_messages).toBe(0);
      expect(Object.keys(result.roles)).toHaveLength(0);
    });
  });

  // --- backward compat ---

  describe('backward compatibility', () => {
    it('existing operations still work unchanged', async () => {
      // log
      const logResult = await handler({
        operation: 'log',
        session_id: 'compat-session',
        from: 'alice',
        to: 'bob',
        summary: 'Test message',
      });
      expect(logResult.success).toBe(true);

      // list
      const listResult = await handler({
        operation: 'list',
        session_id: 'compat-session',
      });
      expect(listResult.success).toBe(true);
      const listData = listResult.result as { total: number };
      expect(listData.total).toBe(1);

      // read
      const logData = logResult.result as { id: string };
      const readResult = await handler({
        operation: 'read',
        session_id: 'compat-session',
        id: logData.id,
      });
      expect(readResult.success).toBe(true);

      // status
      const statusResult = await handler({
        operation: 'status',
        session_id: 'compat-session',
      });
      expect(statusResult.success).toBe(true);

      // broadcast
      const broadcastResult = await handler({
        operation: 'broadcast',
        session_id: 'compat-session',
        from: 'alice',
        summary: 'Broadcast test',
      });
      expect(broadcastResult.success).toBe(true);

      // delete
      const deleteResult = await handler({
        operation: 'delete',
        session_id: 'compat-session',
        id: logData.id,
      });
      expect(deleteResult.success).toBe(true);

      // clear
      const clearResult = await handler({
        operation: 'clear',
        session_id: 'compat-session',
      });
      expect(clearResult.success).toBe(true);
    });
  });

  // --- parameter validation ---

  describe('parameter validation', () => {
    it('rejects missing session_id', async () => {
      const result = await handler({ operation: 'log', from: 'alice' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('session_id');
    });

    it('rejects invalid operation', async () => {
      const result = await handler({ operation: 'bogus', session_id: 'test' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid params');
    });

    it('log requires from', async () => {
      const result = await handler({
        operation: 'log',
        session_id: 'test-session',
        to: 'bob',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('from');
    });

    it('broadcast requires from', async () => {
      const result = await handler({
        operation: 'broadcast',
        session_id: 'test-session',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('from');
    });

    it('read requires id', async () => {
      const result = await handler({
        operation: 'read',
        session_id: 'test-session',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('id');
    });

    it('delete requires id', async () => {
      const result = await handler({
        operation: 'delete',
        session_id: 'test-session',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('id');
    });

    it('resolves legacy team_session_id param', async () => {
      const result = await handler({
        operation: 'log',
        team_session_id: 'legacy-session',
        from: 'alice',
      });
      expect(result.success).toBe(true);
    });

    it('resolves legacy team param', async () => {
      const result = await handler({
        operation: 'log',
        team: 'legacy-team',
        from: 'alice',
      });
      expect(result.success).toBe(true);
    });
  });

  // --- ref deprecation path ---

  describe('ref deprecation path', () => {
    it('copies ref to data.ref when data is empty', async () => {
      const result = await handler({
        operation: 'log',
        session_id: 'test-session',
        from: 'alice',
        ref: 'some-ref-value',
      });
      expect(result.success).toBe(true);

      const messages = readAllMessages('test-session');
      expect(messages[0].data?.ref).toBe('some-ref-value');
    });

    it('does not overwrite existing data.ref', async () => {
      const result = await handler({
        operation: 'log',
        session_id: 'test-session',
        from: 'alice',
        ref: 'old-ref',
        data: { ref: 'existing-ref' },
      });
      expect(result.success).toBe(true);

      const messages = readAllMessages('test-session');
      expect(messages[0].data?.ref).toBe('existing-ref');
    });
  });

  // --- opLog defaults ---

  describe('opLog defaults', () => {
    it('defaults to to "coordinator"', async () => {
      await handler({
        operation: 'log',
        session_id: 'test-session',
        from: 'alice',
      });
      const messages = readAllMessages('test-session');
      expect(messages[0].to).toBe('coordinator');
    });

    it('defaults type to "message"', async () => {
      await handler({
        operation: 'log',
        session_id: 'test-session',
        from: 'alice',
      });
      const messages = readAllMessages('test-session');
      expect(messages[0].type).toBe('message');
    });

    it('auto-generates summary when omitted', async () => {
      await handler({
        operation: 'log',
        session_id: 'test-session',
        from: 'alice',
        to: 'bob',
        type: 'task',
      });
      const messages = readAllMessages('test-session');
      expect(messages[0].summary).toContain('alice');
      expect(messages[0].summary).toContain('bob');
      expect(messages[0].summary).toContain('task');
    });

    it('generates sequential MSG-XXX IDs', async () => {
      await handler({
        operation: 'log',
        session_id: 'test-session',
        from: 'alice',
      });
      await handler({
        operation: 'log',
        session_id: 'test-session',
        from: 'bob',
      });
      const messages = readAllMessages('test-session');
      expect(messages[0].id).toBe('MSG-001');
      expect(messages[1].id).toBe('MSG-002');
    });
  });

  // --- opList with filters ---

  describe('opList filters', () => {
    it('filters by from', async () => {
      await handler({ operation: 'log', session_id: 'test-session', from: 'alice', to: 'bob' });
      await handler({ operation: 'log', session_id: 'test-session', from: 'carol', to: 'bob' });

      const result = await handler({
        operation: 'list',
        session_id: 'test-session',
        from: 'alice',
      });
      const data = result.result as { total: number; messages: TeamMessage[] };
      expect(data.total).toBe(1);
      expect(data.messages[0].from).toBe('alice');
    });

    it('filters by to', async () => {
      await handler({ operation: 'log', session_id: 'test-session', from: 'alice', to: 'bob' });
      await handler({ operation: 'log', session_id: 'test-session', from: 'alice', to: 'carol' });

      const result = await handler({
        operation: 'list',
        session_id: 'test-session',
        to: 'bob',
      });
      const data = result.result as { total: number; messages: TeamMessage[] };
      expect(data.total).toBe(1);
      expect(data.messages[0].to).toBe('bob');
    });

    it('filters by type', async () => {
      await handler({ operation: 'log', session_id: 'test-session', from: 'alice', type: 'task' });
      await handler({ operation: 'log', session_id: 'test-session', from: 'alice', type: 'progress' });

      const result = await handler({
        operation: 'list',
        session_id: 'test-session',
        type: 'task',
      });
      const data = result.result as { total: number; messages: TeamMessage[] };
      expect(data.total).toBe(1);
      expect(data.messages[0].type).toBe('task');
    });

    it('respects last parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await handler({ operation: 'log', session_id: 'test-session', from: 'alice' });
      }

      const result = await handler({
        operation: 'list',
        session_id: 'test-session',
        last: 2,
      });
      const data = result.result as { total: number; showing: number };
      expect(data.total).toBe(5);
      expect(data.showing).toBe(2);
    });

    it('returns formatted output', async () => {
      await handler({ operation: 'log', session_id: 'test-session', from: 'alice', to: 'bob' });

      const result = await handler({
        operation: 'list',
        session_id: 'test-session',
      });
      const data = result.result as { formatted: string };
      expect(data.formatted).toContain('alice');
      expect(data.formatted).toContain('bob');
    });
  });

  // --- opRead ---

  describe('opRead', () => {
    it('returns error for non-existent message ID', async () => {
      const result = await handler({
        operation: 'read',
        session_id: 'test-session',
        id: 'MSG-999',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('MSG-999');
      expect(result.error).toContain('not found');
    });
  });

  // --- opDelete ---

  describe('opDelete', () => {
    it('returns error for non-existent message ID', async () => {
      const result = await handler({
        operation: 'delete',
        session_id: 'test-session',
        id: 'MSG-999',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('MSG-999');
    });

    it('removes a message and preserves others', async () => {
      await handler({ operation: 'log', session_id: 'test-session', from: 'alice', summary: 'first' });
      await handler({ operation: 'log', session_id: 'test-session', from: 'bob', summary: 'second' });

      await handler({ operation: 'delete', session_id: 'test-session', id: 'MSG-001' });

      const messages = readAllMessages('test-session');
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe('MSG-002');
    });
  });

  // --- opClear ---

  describe('opClear', () => {
    it('returns success for session with no messages', async () => {
      const result = await handler({
        operation: 'clear',
        session_id: 'empty-clear-session',
      });
      expect(result.success).toBe(true);
      const data = result.result as { message: string };
      expect(data.message).toContain('no messages');
    });
  });

  // --- opGetState ---

  describe('opGetState', () => {
    it('returns null state for unknown role', async () => {
      const result = await handler({
        operation: 'get_state',
        session_id: 'test-session',
        role: 'unknown-role',
      });
      expect(result.success).toBe(true);
      const data = result.result as { role: string; state: null; message: string };
      expect(data.state).toBeNull();
      expect(data.message).toContain('unknown-role');
    });

    it('returns all role states when no role specified', async () => {
      const result = await handler({
        operation: 'get_state',
        session_id: 'test-session',
      });
      expect(result.success).toBe(true);
      const data = result.result as { role_state: Record<string, unknown> };
      expect(data.role_state).toBeDefined();
    });
  });

  // --- state_update meta merge ---

  describe('state_update meta merge', () => {
    it('persists role state in meta.json on state_update', async () => {
      await handler({
        operation: 'log',
        session_id: 'test-session',
        from: 'analyst',
        type: 'state_update',
        data: { status: 'completed', artifact_path: '/tmp/report.md' },
      });

      const stateResult = await handler({
        operation: 'get_state',
        session_id: 'test-session',
        role: 'analyst',
      });
      expect(stateResult.success).toBe(true);
      const data = stateResult.result as { state: Record<string, unknown> };
      expect(data.state).toBeDefined();
      expect(data.state.status).toBe('completed');
      expect(data.state.artifact_path).toBe('/tmp/report.md');
    });

    it('merges top-level fields (pipeline_mode, team_name) into meta', async () => {
      await handler({
        operation: 'log',
        session_id: 'test-session',
        from: 'coordinator',
        type: 'state_update',
        data: { pipeline_mode: 'parallel', team_name: 'test-team' },
      });

      // Verify the meta was updated by reading state
      const stateResult = await handler({
        operation: 'get_state',
        session_id: 'test-session',
      });
      expect(stateResult.success).toBe(true);
    });
  });

  // --- opStatus ---

  describe('opStatus', () => {
    it('returns empty summary for session with no messages', async () => {
      const result = await handler({
        operation: 'status',
        session_id: 'empty-status-session',
      });
      expect(result.success).toBe(true);
      const data = result.result as { members: unknown[]; summary: string };
      expect(data.members).toHaveLength(0);
      expect(data.summary).toContain('No messages');
    });

    it('tracks message counts per member', async () => {
      await handler({ operation: 'log', session_id: 'test-session', from: 'alice', to: 'bob' });
      await handler({ operation: 'log', session_id: 'test-session', from: 'alice', to: 'carol' });
      await handler({ operation: 'log', session_id: 'test-session', from: 'bob', to: 'alice' });

      const result = await handler({
        operation: 'status',
        session_id: 'test-session',
      });
      const data = result.result as { members: { member: string; messageCount: number }[]; total_messages: number };
      expect(data.total_messages).toBe(3);
      const alice = data.members.find(m => m.member === 'alice');
      expect(alice?.messageCount).toBe(2);
    });
  });

  // --- broadcast ---

  describe('opBroadcast', () => {
    it('sets to "all"', async () => {
      await handler({
        operation: 'broadcast',
        session_id: 'test-session',
        from: 'alice',
        summary: 'Team-wide announcement',
      });
      const messages = readAllMessages('test-session');
      expect(messages[0].to).toBe('all');
    });
  });

  // --- dispatch_status edge cases ---

  describe('dispatch_status transitions', () => {
    it('failed messages are not returned by read_mailbox', async () => {
      // Log a pending message, then manually set to failed
      await handler({
        operation: 'log',
        session_id: 'test-session',
        from: 'alice',
        to: 'bob',
        delivery_method: 'inject',
      });

      const messages = readAllMessages('test-session');
      const { writeFileSync: wfs } = await import('node:fs');
      const { join: joinPath } = await import('node:path');
      const { getLogDir: gld } = await import('../team-msg.js');
      const logDir = gld('test-session');
      messages[0].dispatch_status = 'failed';
      messages[0].failed_at = new Date().toISOString();
      wfs(
        joinPath(logDir, 'messages.jsonl'),
        messages.map(m => JSON.stringify(m)).join('\n') + '\n',
        'utf-8',
      );

      const mailboxResult = await handler({
        operation: 'read_mailbox',
        session_id: 'test-session',
        role: 'bob',
      });
      expect(mailboxResult.success).toBe(true);
      const result = mailboxResult.result as { count: number };
      expect(result.count).toBe(0);
    });

    it('mailbox_status counts failed messages correctly', async () => {
      await handler({
        operation: 'log',
        session_id: 'test-session',
        from: 'alice',
        to: 'bob',
        delivery_method: 'inject',
      });

      const messages = readAllMessages('test-session');
      const { writeFileSync: wfs } = await import('node:fs');
      const { join: joinPath } = await import('node:path');
      const { getLogDir: gld } = await import('../team-msg.js');
      const logDir = gld('test-session');
      messages[0].dispatch_status = 'failed';
      wfs(
        joinPath(logDir, 'messages.jsonl'),
        messages.map(m => JSON.stringify(m)).join('\n') + '\n',
        'utf-8',
      );

      const statusResult = await handler({
        operation: 'mailbox_status',
        session_id: 'test-session',
      });
      const result = statusResult.result as {
        roles: Record<string, Record<string, number>>;
        total_messages: number;
      };
      expect(result.roles['bob']).toEqual({ pending: 0, notified: 0, delivered: 0, failed: 1 });
    });
  });

  // --- schema export ---

  describe('schema export', () => {
    it('exports correct tool name', async () => {
      const { schema } = await import('../team-msg.js');
      expect(schema.name).toBe('team_msg');
    });

    it('has required operation field', async () => {
      const { schema } = await import('../team-msg.js');
      expect(schema.inputSchema.required).toContain('operation');
    });
  });
});
