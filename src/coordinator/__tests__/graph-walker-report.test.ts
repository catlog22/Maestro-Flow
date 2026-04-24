import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GraphWalker } from '../graph-walker.js';
import { DefaultExprEvaluator } from '../expr-evaluator.js';
import { DefaultOutputParser } from '../output-parser.js';
import type {
  ChainGraph,
  CommandExecutor,
  ExecuteRequest,
  ExecuteResult,
  PromptAssembler,
  AssembleRequest,
  WalkerState,
  GraphNode,
} from '../graph-types.js';
import type { GraphLoader } from '../graph-loader.js';

// ---------------------------------------------------------------------------
// Test harness — walker with real sessionDir so loadNodeResult can hit disk.
// The mock executor gets a callback so tests can drop a report file onto disk
// between prompt-assembly and result-loading (i.e., inside execute()), which
// mimics what a real spawned agent does when it runs `maestro coordinate
// report`.
// ---------------------------------------------------------------------------

type ExecuteHook = (req: ExecuteRequest, sessionDir: string) => void;

function createExecutor(opts: {
  sessionDir: string;
  onExecute?: ExecuteHook;
  rawOutput?: string;
  success?: boolean;
}): CommandExecutor & { calls: ExecuteRequest[] } {
  const calls: ExecuteRequest[] = [];
  return {
    calls,
    async execute(req: ExecuteRequest): Promise<ExecuteResult> {
      calls.push(req);
      opts.onExecute?.(req, opts.sessionDir);
      return {
        success: opts.success ?? true,
        raw_output: opts.rawOutput ?? '',
        exec_id: `exec-${calls.length}`,
        duration_ms: 10,
      };
    },
    async abort() { /* noop */ },
  };
}

function createAssembler(): PromptAssembler {
  return {
    async assemble(_req: AssembleRequest): Promise<string> {
      return 'mock prompt';
    },
  };
}

function createLoader(graphs: Record<string, ChainGraph>): GraphLoader {
  return {
    async load(id: string): Promise<ChainGraph> {
      const g = graphs[id];
      if (!g) throw new Error(`Graph not found: ${id}`);
      return g;
    },
    loadSync(id: string): ChainGraph {
      const g = graphs[id];
      if (!g) throw new Error(`Graph not found: ${id}`);
      return g;
    },
    listAll(): string[] { return Object.keys(graphs); },
  } as unknown as GraphLoader;
}

function makeGraph(id: string, nodes: Record<string, GraphNode>, entry?: string): ChainGraph {
  return {
    id,
    name: `Test: ${id}`,
    version: '1.0',
    entry: entry ?? Object.keys(nodes)[0],
    nodes,
  };
}

function makeWalker(
  executor: CommandExecutor,
  loaderGraphs: Record<string, ChainGraph>,
  sessionDir: string,
): GraphWalker {
  return new GraphWalker(
    createLoader(loaderGraphs),
    createAssembler(),
    executor,
    null,
    new DefaultOutputParser(),
    new DefaultExprEvaluator(),
    undefined,
    sessionDir,
    undefined,
  );
}

function makeState(sessionId: string, graphId: string, entry: string): WalkerState {
  return {
    session_id: sessionId,
    graph_id: graphId,
    current_node: entry,
    status: 'running',
    context: {
      inputs: { workflowRoot: '.' },
      project: {
        initialized: false, current_phase: null, phase_status: 'pending',
        phase_artifacts: {}, execution: { tasks_completed: 0, tasks_total: 0 },
        verification_status: 'pending', review_verdict: null, uat_status: 'pending',
        phases_total: 0, phases_completed: 0, accumulated_context: null,
      },
      result: null, analysis: null, visits: {}, var: {},
    },
    history: [],
    fork_state: null,
    delegate_stack: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tool: 'claude',
    auto_mode: true,
    step_mode: false,
    intent: 'test',
  };
}

function reportPath(sessionDir: string, sessionId: string, nodeId: string): string {
  return join(sessionDir, sessionId, 'reports', `${nodeId}.json`);
}

function writeReport(
  sessionDir: string,
  sessionId: string,
  nodeId: string,
  payload: Record<string, unknown>,
): void {
  const p = reportPath(sessionDir, sessionId, nodeId);
  mkdirSync(join(sessionDir, sessionId, 'reports'), { recursive: true });
  writeFileSync(p, JSON.stringify(payload, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GraphWalker — report file first', () => {
  let sessionDir: string;
  const origError = console.error;
  const errorLog: string[] = [];

  beforeEach(() => {
    sessionDir = mkdtempSync(join(tmpdir(), 'maestro-walker-report-'));
    errorLog.length = 0;
    console.error = (msg: unknown) => { errorLog.push(String(msg)); };
  });

  afterEach(() => {
    console.error = origError;
    try { rmSync(sessionDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('uses report file over empty stdout (outcome SUCCESS)', async () => {
    const graph = makeGraph('g', {
      run: { type: 'command', cmd: 'execute', next: 'done' },
      done: { type: 'terminal', status: 'success' },
    });
    const state = makeState('sid-success', 'g', 'run');

    const executor = createExecutor({
      sessionDir,
      rawOutput: '',
      onExecute: (_req, dir) => {
        writeReport(dir, 'sid-success', 'run', {
          status: 'SUCCESS',
          verification_status: 'passed',
          summary: 'via report tool',
          artifacts: ['out.json'],
        });
      },
    });

    const walker = makeWalker(executor, { g: graph }, sessionDir);
    const result = await walker.walkGraph(state, graph);

    assert.strictEqual(result.status, 'completed');
    assert.strictEqual(result.history[0].outcome, 'success');
    const ctxResult = result.context.result as Record<string, unknown>;
    assert.strictEqual(ctxResult.status, 'SUCCESS');
    assert.strictEqual(ctxResult.verification_status, 'passed');
    assert.strictEqual(ctxResult.summary, 'via report tool');
    assert.deepStrictEqual(ctxResult.artifacts, ['out.json']);
  });

  it('honors FAILURE in report file even when stdout contains SUCCESS block', async () => {
    const graph = makeGraph('g', {
      run: { type: 'command', cmd: 'execute', next: 'done' },
      done: { type: 'terminal', status: 'success' },
    });
    const state = makeState('sid-failure', 'g', 'run');

    const executor = createExecutor({
      sessionDir,
      rawOutput: '--- COORDINATE RESULT ---\nSTATUS: SUCCESS\nSUMMARY: stdout lies\n',
      onExecute: (_req, dir) => {
        writeReport(dir, 'sid-failure', 'run', {
          status: 'FAILURE',
          summary: 'real outcome',
        });
      },
    });

    const walker = makeWalker(executor, { g: graph }, sessionDir);
    const result = await walker.walkGraph(state, graph);

    assert.strictEqual(result.status, 'failed');
    assert.strictEqual(result.history[0].outcome, 'failure');
    const ctxResult = result.context.result as Record<string, unknown>;
    assert.strictEqual(ctxResult.status, 'FAILURE');
    assert.strictEqual(ctxResult.summary, 'real outcome');
  });

  it('falls back to stdout parser when report file is missing', async () => {
    const graph = makeGraph('g', {
      run: { type: 'command', cmd: 'execute', next: 'done' },
      done: { type: 'terminal', status: 'success' },
    });
    const state = makeState('sid-fallback', 'g', 'run');

    const executor = createExecutor({
      sessionDir,
      rawOutput: '--- COORDINATE RESULT ---\nSTATUS: SUCCESS\nSUMMARY: from stdout\n',
      // no onExecute — nothing gets written
    });

    const walker = makeWalker(executor, { g: graph }, sessionDir);
    const result = await walker.walkGraph(state, graph);

    assert.strictEqual(result.status, 'completed');
    const ctxResult = result.context.result as Record<string, unknown>;
    assert.strictEqual(ctxResult.status, 'SUCCESS');
    assert.strictEqual(ctxResult.summary, 'from stdout');
  });

  it('deletes stale report file before spawning so the fresh execution is not shadowed', async () => {
    // Pre-seed a stale report that says SUCCESS from a prior run. The
    // executor on this call writes NOTHING to disk — it only emits a
    // FAILURE block on stdout. If the walker forgot to clear the stale file
    // before spawn, it would read SUCCESS from disk and ignore the real
    // FAILURE. Cleanup is verified by checking that the walker's observed
    // outcome matches the stdout (FAILURE), not the stale file (SUCCESS).
    const graph = makeGraph('g', {
      run: { type: 'command', cmd: 'execute', next: 'done' },
      done: { type: 'terminal', status: 'success' },
    });
    const state = makeState('sid-stale', 'g', 'run');

    writeReport(sessionDir, 'sid-stale', 'run', {
      status: 'SUCCESS',
      summary: 'stale from prior run',
    });

    const executor = createExecutor({
      sessionDir,
      rawOutput: '--- COORDINATE RESULT ---\nSTATUS: FAILURE\nSUMMARY: fresh failure\n',
      // no onExecute — fresh run produces NO report file
    });

    const walker = makeWalker(executor, { g: graph }, sessionDir);
    const result = await walker.walkGraph(state, graph);

    assert.strictEqual(result.status, 'failed');
    assert.strictEqual(result.history[0].outcome, 'failure');
    const ctxResult = result.context.result as Record<string, unknown>;
    assert.strictEqual(ctxResult.status, 'FAILURE');
    assert.strictEqual(ctxResult.summary, 'fresh failure');
    // Stale file was removed before spawn and not re-created
    assert.ok(!existsSync(reportPath(sessionDir, 'sid-stale', 'run')));
  });

  it('logs a warning and falls back to parser when report file is malformed', async () => {
    const graph = makeGraph('g', {
      run: { type: 'command', cmd: 'execute', next: 'done' },
      done: { type: 'terminal', status: 'success' },
    });
    const state = makeState('sid-malformed', 'g', 'run');

    const executor = createExecutor({
      sessionDir,
      rawOutput: '--- COORDINATE RESULT ---\nSTATUS: SUCCESS\nSUMMARY: stdout parsed\n',
      onExecute: (_req, dir) => {
        const p = reportPath(dir, 'sid-malformed', 'run');
        mkdirSync(join(dir, 'sid-malformed', 'reports'), { recursive: true });
        writeFileSync(p, '{ not valid json', 'utf-8');
      },
    });

    const walker = makeWalker(executor, { g: graph }, sessionDir);
    const result = await walker.walkGraph(state, graph);

    // Stdout fallback succeeded
    assert.strictEqual(result.status, 'completed');
    const ctxResult = result.context.result as Record<string, unknown>;
    assert.strictEqual(ctxResult.status, 'SUCCESS');
    assert.strictEqual(ctxResult.summary, 'stdout parsed');
    // Warning was logged
    assert.ok(
      errorLog.some(l => l.includes('malformed') && l.includes('Falling back')),
      `expected malformed warning, got: ${errorLog.join(' | ')}`,
    );
  });

  it('decision node branches on verification_status from report file', async () => {
    const graph = makeGraph('g', {
      run: { type: 'command', cmd: 'verify', next: 'decide' },
      decide: {
        type: 'decision',
        eval: 'result.verification_status',
        edges: [
          { value: 'passed', target: 'ok' },
          { default: true, target: 'fail_term' },
        ],
      },
      ok: { type: 'terminal', status: 'success' },
      fail_term: { type: 'terminal', status: 'failure' },
    });
    const state = makeState('sid-decide', 'g', 'run');

    const executor = createExecutor({
      sessionDir,
      rawOutput: '',
      onExecute: (_req, dir) => {
        writeReport(dir, 'sid-decide', 'run', {
          status: 'SUCCESS',
          verification_status: 'passed',
        });
      },
    });

    const walker = makeWalker(executor, { g: graph }, sessionDir);
    const result = await walker.walkGraph(state, graph);

    assert.strictEqual(result.status, 'completed');
    // Final command was routed through `ok`, not `fail_term`
    const nodeIds = result.history.map(h => h.node_id);
    assert.ok(nodeIds.includes('ok'));
    assert.ok(!nodeIds.includes('fail_term'));
  });
});
