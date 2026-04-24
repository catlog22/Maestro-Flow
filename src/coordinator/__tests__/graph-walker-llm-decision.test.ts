import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
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
  LLMDecider,
  LLMDecisionRequest,
  LLMDecisionResult,
} from '../graph-types.js';
import type { GraphLoader } from '../graph-loader.js';

// ---------------------------------------------------------------------------
// Harness — minimal walker with injectable LLM decider. The command node in
// these tests runs a no-op executor that emits a COORDINATE RESULT stdout
// block, then hands control to the decision node under test.
// ---------------------------------------------------------------------------

function createExecutor(rawOutput: string): CommandExecutor & { calls: ExecuteRequest[] } {
  const calls: ExecuteRequest[] = [];
  return {
    calls,
    async execute(req: ExecuteRequest): Promise<ExecuteResult> {
      calls.push(req);
      return {
        success: true,
        raw_output: rawOutput,
        exec_id: `exec-${calls.length}`,
        duration_ms: 1,
      };
    },
    async abort() { /* noop */ },
  };
}

function createAssembler(): PromptAssembler {
  return {
    async assemble(_req: AssembleRequest): Promise<string> { return 'prompt'; },
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
  graphs: Record<string, ChainGraph>,
  sessionDir: string,
  decider: LLMDecider | null | undefined,
): GraphWalker {
  return new GraphWalker(
    createLoader(graphs),
    createAssembler(),
    executor,
    null,
    new DefaultOutputParser(),
    new DefaultExprEvaluator(),
    undefined,
    sessionDir,
    undefined,
    decider,
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

interface RecordingDecider extends LLMDecider {
  calls: LLMDecisionRequest[];
}

function recordingDecider(fn: (req: LLMDecisionRequest) => LLMDecisionResult | null): RecordingDecider {
  const calls: LLMDecisionRequest[] = [];
  return {
    calls,
    async decide(req: LLMDecisionRequest) {
      calls.push(req);
      return fn(req);
    },
  };
}

const SUCCESS_STDOUT = '--- COORDINATE RESULT ---\nSTATUS: SUCCESS\nSUMMARY: ok\n';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GraphWalker — LLM decision fallback', () => {
  let sessionDir: string;

  beforeEach(() => {
    sessionDir = mkdtempSync(join(tmpdir(), 'maestro-walker-llm-'));
  });

  afterEach(() => {
    try { rmSync(sessionDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('strategy=llm calls the decider and routes to the chosen target', async () => {
    const graph = makeGraph('g', {
      run: { type: 'command', cmd: 'c', next: 'pick' },
      pick: {
        type: 'decision',
        strategy: 'llm',
        prompt: 'pick best',
        edges: [
          { target: 'ok' },
          { target: 'bad' },
          { target: 'fallback', default: true },
        ],
      },
      ok: { type: 'terminal', status: 'success' },
      bad: { type: 'terminal', status: 'failure' },
      fallback: { type: 'terminal', status: 'failure' },
    });
    const decider = recordingDecider(() => ({ target: 'ok', reasoning: 'looks good' }));
    const walker = makeWalker(createExecutor(SUCCESS_STDOUT), { g: graph }, sessionDir, decider);
    const result = await walker.walkGraph(makeState('sid-llm-1', 'g', 'run'), graph);

    assert.strictEqual(decider.calls.length, 1);
    assert.strictEqual(result.status, 'completed');
    const nodeIds = result.history.map(h => h.node_id);
    assert.ok(nodeIds.includes('ok'));
    assert.ok(!nodeIds.includes('bad'));
    assert.ok(!nodeIds.includes('fallback'));
  });

  it('strategy=llm with null decider result falls through to default edge', async () => {
    const graph = makeGraph('g', {
      run: { type: 'command', cmd: 'c', next: 'pick' },
      pick: {
        type: 'decision',
        strategy: 'llm',
        edges: [
          { target: 'ok' },
          { target: 'fallback', default: true },
        ],
      },
      ok: { type: 'terminal', status: 'success' },
      fallback: { type: 'terminal', status: 'failure' },
    });
    const decider = recordingDecider(() => null);
    const walker = makeWalker(createExecutor(SUCCESS_STDOUT), { g: graph }, sessionDir, decider);
    const result = await walker.walkGraph(makeState('sid-llm-2', 'g', 'run'), graph);

    assert.strictEqual(decider.calls.length, 1);
    assert.strictEqual(result.status, 'failed');
    const nodeIds = result.history.map(h => h.node_id);
    assert.ok(nodeIds.includes('fallback'));
    assert.ok(!nodeIds.includes('ok'));
  });

  it('strategy=expr with matching edge does NOT call the decider (fast path)', async () => {
    const graph = makeGraph('g', {
      run: { type: 'command', cmd: 'c', next: 'pick' },
      pick: {
        type: 'decision',
        strategy: 'expr',
        eval: 'result.status',
        edges: [
          { value: 'SUCCESS', target: 'ok' },
          { target: 'fail', default: true },
        ],
      },
      ok: { type: 'terminal', status: 'success' },
      fail: { type: 'terminal', status: 'failure' },
    });
    const decider = recordingDecider(() => ({ target: 'fail', reasoning: 'should not run' }));
    const walker = makeWalker(createExecutor(SUCCESS_STDOUT), { g: graph }, sessionDir, decider);
    const result = await walker.walkGraph(makeState('sid-llm-3', 'g', 'run'), graph);

    assert.strictEqual(decider.calls.length, 0, 'decider must not be called when expr matches');
    assert.strictEqual(result.status, 'completed');
    assert.ok(result.history.map(h => h.node_id).includes('ok'));
  });

  it('strategy=expr no-match with default edge does NOT call the decider', async () => {
    const graph = makeGraph('g', {
      run: { type: 'command', cmd: 'c', next: 'pick' },
      pick: {
        type: 'decision',
        strategy: 'expr',
        eval: 'result.nonexistent',
        edges: [
          { value: 'x', target: 'ok' },
          { target: 'fallback', default: true },
        ],
      },
      ok: { type: 'terminal', status: 'success' },
      fallback: { type: 'terminal', status: 'success' },
    });
    const decider = recordingDecider(() => ({ target: 'ok', reasoning: 'x' }));
    const walker = makeWalker(createExecutor(SUCCESS_STDOUT), { g: graph }, sessionDir, decider);
    const result = await walker.walkGraph(makeState('sid-llm-4', 'g', 'run'), graph);

    assert.strictEqual(decider.calls.length, 0, 'default edge should win before decider');
    assert.strictEqual(result.status, 'completed');
    assert.ok(result.history.map(h => h.node_id).includes('fallback'));
  });

  it('strategy=expr no-match no-default calls decider as fallback', async () => {
    const graph = makeGraph('g', {
      run: { type: 'command', cmd: 'c', next: 'pick' },
      pick: {
        type: 'decision',
        strategy: 'expr',
        eval: 'result.nonexistent',
        edges: [
          { value: 'x', target: 'ok' },
          { value: 'y', target: 'other' },
        ],
      },
      ok: { type: 'terminal', status: 'success' },
      other: { type: 'terminal', status: 'success' },
    });
    const decider = recordingDecider(() => ({ target: 'other', reasoning: 'llm picked this' }));
    const walker = makeWalker(createExecutor(SUCCESS_STDOUT), { g: graph }, sessionDir, decider);
    const result = await walker.walkGraph(makeState('sid-llm-5', 'g', 'run'), graph);

    assert.strictEqual(decider.calls.length, 1);
    assert.strictEqual(result.status, 'completed');
    const nodeIds = result.history.map(h => h.node_id);
    assert.ok(nodeIds.includes('other'));
    assert.ok(!nodeIds.includes('ok'));
  });

  it('strategy=expr no-match no-default with NO decider fails (backward compat)', async () => {
    const graph = makeGraph('g', {
      run: { type: 'command', cmd: 'c', next: 'pick' },
      pick: {
        type: 'decision',
        strategy: 'expr',
        eval: 'result.nonexistent',
        edges: [
          { value: 'x', target: 'ok' },
        ],
      },
      ok: { type: 'terminal', status: 'success' },
    });
    const walker = makeWalker(createExecutor(SUCCESS_STDOUT), { g: graph }, sessionDir, undefined);
    const result = await walker.walkGraph(makeState('sid-llm-6', 'g', 'run'), graph);

    assert.strictEqual(result.status, 'failed');
  });

  it('walker assembles the decision prompt and passes it to the thin decider', async () => {
    const graph = makeGraph('g', {
      run: { type: 'command', cmd: 'c', next: 'pick' },
      pick: {
        type: 'decision',
        strategy: 'llm',
        prompt: 'look at result.summary',
        context_keys: ['result.status', 'result.summary'],
        edges: [
          { target: 'ok' },
          { target: 'fallback', default: true },
        ],
      },
      ok: { type: 'terminal', status: 'success' },
      fallback: { type: 'terminal', status: 'failure' },
    });
    const decider = recordingDecider(() => ({ target: 'ok', reasoning: 'x' }));
    const walker = makeWalker(createExecutor(SUCCESS_STDOUT), { g: graph }, sessionDir, decider);
    await walker.walkGraph(makeState('sid-llm-7', 'g', 'run'), graph);

    assert.strictEqual(decider.calls.length, 1);
    const req = decider.calls[0];
    assert.strictEqual(req.node_id, 'pick');

    // valid_targets reflects the live edge list
    assert.deepStrictEqual([...req.valid_targets].sort(), ['fallback', 'ok']);

    // Prompt is fully assembled by the walker and includes: node purpose,
    // every edge target, the filtered context keys, and the DECISION format.
    assert.ok(req.prompt.includes('look at result.summary'), 'prompt should include node.prompt');
    assert.ok(req.prompt.includes('target: ok'));
    assert.ok(req.prompt.includes('target: fallback'));
    assert.ok(req.prompt.includes('"result.status"'));
    assert.ok(req.prompt.includes('"result.summary"'));
    assert.ok(req.prompt.includes('SUCCESS'));
    assert.ok(req.prompt.includes('DECISION:'));
    assert.ok(req.prompt.includes('REASONING:'));
  });
});
