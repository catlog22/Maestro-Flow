import { describe, it, expect } from 'vitest';
import { EntryNormalizer } from './entry-normalizer.js';

const PID = 'proc-test-001';

describe('EntryNormalizer', () => {
  describe('userMessage', () => {
    it('creates entry with correct type and content', () => {
      const entry = EntryNormalizer.userMessage(PID, 'hello');
      expect(entry.type).toBe('user_message');
      expect(entry.content).toBe('hello');
      expect(entry.processId).toBe(PID);
    });

    it('generates unique ids', () => {
      const a = EntryNormalizer.userMessage(PID, 'a');
      const b = EntryNormalizer.userMessage(PID, 'b');
      expect(a.id).not.toBe(b.id);
    });

    it('generates ISO timestamp', () => {
      const entry = EntryNormalizer.userMessage(PID, 'test');
      expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('assistantMessage', () => {
    it('includes partial flag', () => {
      const entry = EntryNormalizer.assistantMessage(PID, 'reply', true);
      expect(entry.type).toBe('assistant_message');
      expect(entry.partial).toBe(true);
    });

    it('sets partial to false', () => {
      const entry = EntryNormalizer.assistantMessage(PID, 'done', false);
      expect(entry.partial).toBe(false);
    });
  });

  describe('thinking', () => {
    it('creates thinking entry', () => {
      const entry = EntryNormalizer.thinking(PID, 'pondering...');
      expect(entry.type).toBe('thinking');
      expect(entry.content).toBe('pondering...');
    });
  });

  describe('toolUse', () => {
    it('creates tool use entry with status', () => {
      const entry = EntryNormalizer.toolUse(PID, 'Read', { path: '/test' }, 'completed', 'ok');
      expect(entry.type).toBe('tool_use');
      expect(entry.name).toBe('Read');
      expect(entry.input).toEqual({ path: '/test' });
      expect(entry.status).toBe('completed');
      expect(entry.result).toBe('ok');
    });

    it('result is optional', () => {
      const entry = EntryNormalizer.toolUse(PID, 'Write', {}, 'pending');
      expect(entry.result).toBeUndefined();
    });
  });

  describe('fileChange', () => {
    it('creates file change entry', () => {
      const entry = EntryNormalizer.fileChange(PID, '/src/test.ts', 'create', '+line');
      expect(entry.type).toBe('file_change');
      expect(entry.path).toBe('/src/test.ts');
      expect(entry.action).toBe('create');
      expect(entry.diff).toBe('+line');
    });

    it('diff is optional', () => {
      const entry = EntryNormalizer.fileChange(PID, '/src/x.ts', 'delete');
      expect(entry.diff).toBeUndefined();
    });
  });

  describe('commandExec', () => {
    it('creates command exec entry', () => {
      const entry = EntryNormalizer.commandExec(PID, 'npm test', 0, 'PASS');
      expect(entry.type).toBe('command_exec');
      expect(entry.command).toBe('npm test');
      expect(entry.exitCode).toBe(0);
      expect(entry.output).toBe('PASS');
    });
  });

  describe('approvalRequest', () => {
    it('creates approval request', () => {
      const entry = EntryNormalizer.approvalRequest(PID, 'Bash', { cmd: 'rm -rf' }, 'req-1');
      expect(entry.type).toBe('approval_request');
      expect(entry.toolName).toBe('Bash');
      expect(entry.requestId).toBe('req-1');
    });
  });

  describe('approvalResponse', () => {
    it('creates approval response', () => {
      const entry = EntryNormalizer.approvalResponse(PID, 'req-1', true);
      expect(entry.type).toBe('approval_response');
      expect(entry.requestId).toBe('req-1');
      expect(entry.allowed).toBe(true);
    });
  });

  describe('error', () => {
    it('creates error entry', () => {
      const entry = EntryNormalizer.error(PID, 'something broke', 'ERR_001');
      expect(entry.type).toBe('error');
      expect(entry.message).toBe('something broke');
      expect(entry.code).toBe('ERR_001');
    });

    it('code is optional', () => {
      const entry = EntryNormalizer.error(PID, 'oops');
      expect(entry.code).toBeUndefined();
    });
  });

  describe('statusChange', () => {
    it('creates status change entry', () => {
      const entry = EntryNormalizer.statusChange(PID, 'running', 'started');
      expect(entry.type).toBe('status_change');
      expect(entry.status).toBe('running');
      expect(entry.reason).toBe('started');
    });
  });

  describe('tokenUsage', () => {
    it('creates token usage entry', () => {
      const entry = EntryNormalizer.tokenUsage(PID, 100, 200, 50, 25);
      expect(entry.type).toBe('token_usage');
      expect(entry.inputTokens).toBe(100);
      expect(entry.outputTokens).toBe(200);
      expect(entry.cacheReadTokens).toBe(50);
      expect(entry.cacheWriteTokens).toBe(25);
    });

    it('cache tokens are optional', () => {
      const entry = EntryNormalizer.tokenUsage(PID, 10, 20);
      expect(entry.cacheReadTokens).toBeUndefined();
      expect(entry.cacheWriteTokens).toBeUndefined();
    });
  });
});
