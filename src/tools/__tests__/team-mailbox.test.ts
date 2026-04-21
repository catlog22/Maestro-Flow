import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import {
  mkdtempSync,
  rmSync,
  existsSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { handler } from '../team-mailbox.js';
import type { MailboxMessage } from '../team-mailbox.js';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

let tmpDir: string;
let prevRoot: string | undefined;

function setup(): void {
  tmpDir = mkdtempSync(join(tmpdir(), 'team-mailbox-test-'));
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

describe('team-mailbox', () => {
  beforeEach(setup);
  afterEach(teardown);

  // --- Parameter validation ---

  describe('parameter validation', () => {
    it('rejects missing session_id', async () => {
      const result = await handler({ operation: 'send', from: 'a', to: 'b', message: 'hi' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('session_id');
    });

    it('rejects invalid operation', async () => {
      const result = await handler({ operation: 'bogus', session_id: 's1' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid params');
    });

    it('send requires from', async () => {
      const result = await handler({ operation: 'send', session_id: 's1', to: 'bob', message: 'hi' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('from');
    });

    it('send requires to', async () => {
      const result = await handler({ operation: 'send', session_id: 's1', from: 'alice', message: 'hi' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('to');
    });

    it('send requires message', async () => {
      const result = await handler({ operation: 'send', session_id: 's1', from: 'alice', to: 'bob' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('message');
    });

    it('read requires role', async () => {
      const result = await handler({ operation: 'read', session_id: 's1' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('role');
    });
  });

  // --- Send operation ---

  describe('send', () => {
    it('persists message to mailbox.jsonl', async () => {
      const result = await handler({
        operation: 'send',
        session_id: 'test-session',
        from: 'alice',
        to: 'bob',
        message: 'Hello Bob',
        delivery_method: 'poll',
      });

      expect(result.success).toBe(true);
      const data = result.result as { id: string; delivery_method: string; delivery_status: string };
      expect(data.id).toMatch(/^MBX-\d{3}$/);
      expect(data.delivery_method).toBe('poll');
      expect(data.delivery_status).toBe('pending');

      // Verify file exists
      const mailboxPath = join(tmpDir, '.workflow', '.team', 'test-session', '.msg', 'mailbox.jsonl');
      expect(existsSync(mailboxPath)).toBe(true);
    });

    it('auto-increments message IDs', async () => {
      await handler({
        operation: 'send',
        session_id: 'test-session',
        from: 'alice',
        to: 'bob',
        message: 'First',
      });
      await handler({
        operation: 'send',
        session_id: 'test-session',
        from: 'alice',
        to: 'bob',
        message: 'Second',
      });

      const readResult = await handler({
        operation: 'read',
        session_id: 'test-session',
        role: 'bob',
        mark_delivered: false,
      });

      const data = readResult.result as { messages: MailboxMessage[] };
      expect(data.messages).toHaveLength(2);
      expect(data.messages[0].id).toBe('MBX-001');
      expect(data.messages[1].id).toBe('MBX-002');
    });

    it('defaults type to "message" when omitted', async () => {
      await handler({
        operation: 'send',
        session_id: 'test-session',
        from: 'alice',
        to: 'bob',
        message: 'Hello',
      });

      const readResult = await handler({
        operation: 'read',
        session_id: 'test-session',
        role: 'bob',
        mark_delivered: false,
      });

      const data = readResult.result as { messages: MailboxMessage[] };
      expect(data.messages[0].type).toBe('message');
    });

    it('defaults delivery_method to "inject"', async () => {
      const result = await handler({
        operation: 'send',
        session_id: 'test-session',
        from: 'alice',
        to: 'bob',
        message: 'Hello',
      });

      const data = result.result as { delivery_method: string };
      expect(data.delivery_method).toBe('inject');
    });

    it('accepts custom type and data', async () => {
      await handler({
        operation: 'send',
        session_id: 'test-session',
        from: 'alice',
        to: 'bob',
        message: 'Task done',
        type: 'task_complete',
        data: { task_id: 'T-001', result: 'success' },
      });

      const readResult = await handler({
        operation: 'read',
        session_id: 'test-session',
        role: 'bob',
        mark_delivered: false,
      });

      const data = readResult.result as { messages: MailboxMessage[] };
      expect(data.messages[0].type).toBe('task_complete');
      expect(data.messages[0].data).toEqual({ task_id: 'T-001', result: 'success' });
    });

    it('inject delivery gracefully handles missing broker job', async () => {
      // No delegate job registered, should still succeed with message persisted
      const result = await handler({
        operation: 'send',
        session_id: 'test-session',
        from: 'alice',
        to: 'bob',
        message: 'Hello',
        delivery_method: 'inject',
      });

      expect(result.success).toBe(true);
      const data = result.result as { delivery_status: string; message: string };
      expect(data.delivery_status).toBe('pending');
      // Should mention inject attempt result
      expect(data.message).toContain('inject');
    });
  });

  // --- Read operation ---

  describe('read', () => {
    it('returns unread messages for a role', async () => {
      await handler({
        operation: 'send',
        session_id: 'test-session',
        from: 'alice',
        to: 'bob',
        message: 'Hello Bob',
      });
      await handler({
        operation: 'send',
        session_id: 'test-session',
        from: 'alice',
        to: 'carol',
        message: 'Hello Carol',
      });

      const result = await handler({
        operation: 'read',
        session_id: 'test-session',
        role: 'bob',
      });

      expect(result.success).toBe(true);
      const data = result.result as { role: string; unread_count: number; total_pending: number; messages: MailboxMessage[] };
      expect(data.role).toBe('bob');
      expect(data.unread_count).toBe(1);
      expect(data.messages[0].message).toBe('Hello Bob');
    });

    it('marks messages as delivered by default', async () => {
      await handler({
        operation: 'send',
        session_id: 'test-session',
        from: 'alice',
        to: 'bob',
        message: 'Hello',
      });

      await handler({
        operation: 'read',
        session_id: 'test-session',
        role: 'bob',
      });

      // Second read should return empty
      const result = await handler({
        operation: 'read',
        session_id: 'test-session',
        role: 'bob',
      });

      const data = result.result as { unread_count: number };
      expect(data.unread_count).toBe(0);
    });

    it('does not mark messages when mark_delivered=false', async () => {
      await handler({
        operation: 'send',
        session_id: 'test-session',
        from: 'alice',
        to: 'bob',
        message: 'Hello',
      });

      await handler({
        operation: 'read',
        session_id: 'test-session',
        role: 'bob',
        mark_delivered: false,
      });

      // Second read should still return the message
      const result = await handler({
        operation: 'read',
        session_id: 'test-session',
        role: 'bob',
        mark_delivered: false,
      });

      const data = result.result as { unread_count: number };
      expect(data.unread_count).toBe(1);
    });

    it('respects limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await handler({
          operation: 'send',
          session_id: 'test-session',
          from: 'alice',
          to: 'bob',
          message: `Message ${i}`,
        });
      }

      const result = await handler({
        operation: 'read',
        session_id: 'test-session',
        role: 'bob',
        limit: 2,
        mark_delivered: false,
      });

      const data = result.result as { unread_count: number; total_pending: number };
      expect(data.unread_count).toBe(2);
      expect(data.total_pending).toBe(5);
    });

    it('returns formatted output', async () => {
      await handler({
        operation: 'send',
        session_id: 'test-session',
        from: 'alice',
        to: 'bob',
        message: 'Hello',
      });

      const result = await handler({
        operation: 'read',
        session_id: 'test-session',
        role: 'bob',
        mark_delivered: false,
      });

      const data = result.result as { formatted: string };
      expect(data.formatted).toContain('alice');
      expect(data.formatted).toContain('bob');
    });

    it('returns empty for role with no messages', async () => {
      const result = await handler({
        operation: 'read',
        session_id: 'test-session',
        role: 'nobody',
      });

      const data = result.result as { unread_count: number; messages: MailboxMessage[] };
      expect(data.unread_count).toBe(0);
      expect(data.messages).toHaveLength(0);
    });
  });

  // --- Status operation ---

  describe('status', () => {
    it('returns per-role counts', async () => {
      await handler({
        operation: 'send',
        session_id: 'test-session',
        from: 'alice',
        to: 'bob',
        message: 'Hello Bob',
      });
      await handler({
        operation: 'send',
        session_id: 'test-session',
        from: 'alice',
        to: 'carol',
        message: 'Hello Carol',
      });

      const result = await handler({
        operation: 'status',
        session_id: 'test-session',
      });

      expect(result.success).toBe(true);
      const data = result.result as {
        roles: { role: string; pending: number; notified: number; delivered: number; failed: number }[];
        total_messages: number;
        formatted: string;
      };

      expect(data.total_messages).toBe(2);
      expect(data.roles).toHaveLength(2);

      const bobStatus = data.roles.find(r => r.role === 'bob');
      expect(bobStatus).toBeDefined();
      expect(bobStatus!.pending).toBe(1);
      expect(bobStatus!.delivered).toBe(0);

      const carolStatus = data.roles.find(r => r.role === 'carol');
      expect(carolStatus).toBeDefined();
      expect(carolStatus!.pending).toBe(1);
    });

    it('returns empty for session with no messages', async () => {
      const result = await handler({
        operation: 'status',
        session_id: 'empty-session',
      });

      expect(result.success).toBe(true);
      const data = result.result as {
        roles: unknown[];
        total_messages: number;
        summary: string;
      };

      expect(data.total_messages).toBe(0);
      expect(data.roles).toHaveLength(0);
      expect(data.summary).toContain('No mailbox messages');
    });

    it('counts delivered and pending correctly after read', async () => {
      await handler({
        operation: 'send',
        session_id: 'test-session',
        from: 'alice',
        to: 'bob',
        message: 'First',
      });
      await handler({
        operation: 'send',
        session_id: 'test-session',
        from: 'alice',
        to: 'bob',
        message: 'Second',
      });

      // Read and deliver first message
      await handler({
        operation: 'read',
        session_id: 'test-session',
        role: 'bob',
        limit: 1,
      });

      const statusResult = await handler({
        operation: 'status',
        session_id: 'test-session',
      });

      const data = statusResult.result as {
        roles: { role: string; pending: number; delivered: number }[];
      };

      const bobStatus = data.roles.find(r => r.role === 'bob');
      expect(bobStatus!.pending).toBe(1);
      expect(bobStatus!.delivered).toBe(1);
    });

    it('returns formatted status output', async () => {
      await handler({
        operation: 'send',
        session_id: 'test-session',
        from: 'alice',
        to: 'bob',
        message: 'Hello',
      });

      const result = await handler({
        operation: 'status',
        session_id: 'test-session',
      });

      const data = result.result as { formatted: string };
      expect(data.formatted).toContain('bob');
      expect(data.formatted).toContain('pending');
    });
  });

  // --- Multi-session isolation ---

  describe('multi-session isolation', () => {
    it('messages are isolated per session', async () => {
      await handler({
        operation: 'send',
        session_id: 'session-a',
        from: 'alice',
        to: 'bob',
        message: 'A message',
      });
      await handler({
        operation: 'send',
        session_id: 'session-b',
        from: 'alice',
        to: 'bob',
        message: 'B message',
      });

      const resultA = await handler({
        operation: 'read',
        session_id: 'session-a',
        role: 'bob',
        mark_delivered: false,
      });
      const resultB = await handler({
        operation: 'read',
        session_id: 'session-b',
        role: 'bob',
        mark_delivered: false,
      });

      const dataA = resultA.result as { messages: MailboxMessage[] };
      const dataB = resultB.result as { messages: MailboxMessage[] };

      expect(dataA.messages).toHaveLength(1);
      expect(dataA.messages[0].message).toBe('A message');
      expect(dataB.messages).toHaveLength(1);
      expect(dataB.messages[0].message).toBe('B message');
    });
  });

  // --- Delivery method variants ---

  describe('delivery method variants', () => {
    it('poll delivery does not attempt broker inject', async () => {
      const result = await handler({
        operation: 'send',
        session_id: 'test-session',
        from: 'alice',
        to: 'bob',
        message: 'Poll message',
        delivery_method: 'poll',
      });

      expect(result.success).toBe(true);
      const data = result.result as { delivery_method: string; delivery_status: string };
      expect(data.delivery_method).toBe('poll');
      expect(data.delivery_status).toBe('pending');
    });

    it('broadcast delivery does not attempt broker inject', async () => {
      const result = await handler({
        operation: 'send',
        session_id: 'test-session',
        from: 'alice',
        to: 'bob',
        message: 'Broadcast message',
        delivery_method: 'broadcast',
      });

      expect(result.success).toBe(true);
      const data = result.result as { delivery_method: string; delivery_status: string };
      expect(data.delivery_method).toBe('broadcast');
      expect(data.delivery_status).toBe('pending');
    });
  });

  // --- Message content in results ---

  describe('message content in results', () => {
    it('truncates long messages in send result', async () => {
      const longMessage = 'A'.repeat(200);
      const result = await handler({
        operation: 'send',
        session_id: 'test-session',
        from: 'alice',
        to: 'bob',
        message: longMessage,
      });

      expect(result.success).toBe(true);
      const data = result.result as { message: string };
      expect(data.message).toContain('...');
    });

    it('does not truncate short messages in send result', async () => {
      const shortMessage = 'Hello';
      const result = await handler({
        operation: 'send',
        session_id: 'test-session',
        from: 'alice',
        to: 'bob',
        message: shortMessage,
      });

      expect(result.success).toBe(true);
      const data = result.result as { message: string };
      expect(data.message).not.toContain('...');
    });
  });

  // --- Read edge cases ---

  describe('read edge cases', () => {
    it('read returns total_pending correctly with limit', async () => {
      for (let i = 0; i < 3; i++) {
        await handler({
          operation: 'send',
          session_id: 'test-session',
          from: 'alice',
          to: 'bob',
          message: `Message ${i}`,
        });
      }

      const result = await handler({
        operation: 'read',
        session_id: 'test-session',
        role: 'bob',
        limit: 1,
        mark_delivered: false,
      });

      const data = result.result as { unread_count: number; total_pending: number };
      expect(data.unread_count).toBe(1);
      expect(data.total_pending).toBe(3);
    });

    it('read ignores messages already delivered', async () => {
      await handler({
        operation: 'send',
        session_id: 'test-session',
        from: 'alice',
        to: 'bob',
        message: 'First',
      });
      await handler({
        operation: 'send',
        session_id: 'test-session',
        from: 'alice',
        to: 'bob',
        message: 'Second',
      });

      // Deliver first message
      await handler({
        operation: 'read',
        session_id: 'test-session',
        role: 'bob',
        limit: 1,
      });

      // Read again - only second should appear
      const result = await handler({
        operation: 'read',
        session_id: 'test-session',
        role: 'bob',
        mark_delivered: false,
      });

      const data = result.result as { unread_count: number; messages: MailboxMessage[] };
      expect(data.unread_count).toBe(1);
      expect(data.messages[0].message).toBe('Second');
    });
  });

  // --- Status edge cases ---

  describe('status edge cases', () => {
    it('status counts notified messages correctly', async () => {
      await handler({
        operation: 'send',
        session_id: 'test-session',
        from: 'alice',
        to: 'bob',
        message: 'Hello',
      });

      // The inject attempt will fail (no broker job), so status remains pending
      const statusResult = await handler({
        operation: 'status',
        session_id: 'test-session',
      });

      expect(statusResult.success).toBe(true);
      const data = statusResult.result as {
        roles: { role: string; pending: number }[];
        total_messages: number;
      };
      expect(data.total_messages).toBe(1);
      const bobStatus = data.roles.find(r => r.role === 'bob');
      expect(bobStatus).toBeDefined();
      expect(bobStatus!.pending).toBe(1);
    });

    it('status returns formatted output with role details', async () => {
      await handler({
        operation: 'send',
        session_id: 'test-session',
        from: 'alice',
        to: 'bob',
        message: 'Hello',
      });

      const result = await handler({
        operation: 'status',
        session_id: 'test-session',
      });

      const data = result.result as { formatted: string };
      expect(data.formatted).toContain('bob');
      expect(data.formatted).toContain('pending');
    });
  });

  // --- Schema export ---

  describe('schema export', () => {
    it('exports correct tool name', async () => {
      const { schema } = await import('../team-mailbox.js');
      expect(schema.name).toBe('team_mailbox');
    });

    it('has required operation field', async () => {
      const { schema } = await import('../team-mailbox.js');
      expect(schema.inputSchema.required).toContain('operation');
    });

    it('lists all three operations', async () => {
      const { schema } = await import('../team-mailbox.js');
      const props = schema.inputSchema.properties as Record<string, { enum?: string[] }>;
      expect(props.operation.enum).toContain('send');
      expect(props.operation.enum).toContain('read');
      expect(props.operation.enum).toContain('status');
    });
  });
});
