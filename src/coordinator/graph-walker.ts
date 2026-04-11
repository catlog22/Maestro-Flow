// Graph Walker — State machine that traverses ChainGraph nodes autonomously.

import { writeFileSync, readFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import type {
  ChainGraph, CommandNode, DecisionNode, EvalNode, ForkNode,
  GateNode, JoinNode, TerminalNode, WalkerState, WalkerContext,
  ProjectSnapshot, HistoryEntry, CommandExecutor, PromptAssembler,
  ExprEvaluator, OutputParser, StepAnalyzer, WalkerEventEmitter, RetryPolicy,
  CoordinateEvent, AssembleRequest, AgentType,
} from './graph-types.js';
import type { GraphLoader } from './graph-loader.js';
import type { ParallelCommandExecutor, BranchResult } from './parallel-executor.js';

export interface StartOptions {
  tool: string;
  autoMode: boolean;
  dryRun?: boolean;
  stepMode?: boolean;
  workflowRoot: string;
  inputs?: Record<string, unknown>;
}

export class GraphWalker {
  private activeState: WalkerState | null = null;

  constructor(
    private readonly loader: GraphLoader,
    private readonly assembler: PromptAssembler,
    private readonly executor: CommandExecutor,
    private readonly analyzer: StepAnalyzer | null,
    private readonly outputParser: OutputParser,
    private readonly evaluator: ExprEvaluator,
    private readonly emitter?: WalkerEventEmitter,
    private readonly sessionDir?: string,
    private readonly parallelExecutor?: ParallelCommandExecutor,
  ) {}

  async start(graphId: string, intent: string, options: StartOptions): Promise<WalkerState> {
    const sessionId = `coord-${Date.now()}-${randomBytes(2).toString('hex')}`;
    const graph = await this.loader.load(graphId);
    const ctx = this.buildInitialContext(options);
    const state: WalkerState = {
      session_id: sessionId,
      graph_id: graphId,
      current_node: graph.entry,
      status: 'running',
      context: ctx,
      history: [],
      fork_state: null,
      delegate_stack: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tool: options.tool,
      auto_mode: options.autoMode,
      step_mode: options.stepMode ?? false,
      intent,
      recovery: {
        total_retries: 0,
        total_failures: 0,
        auto_skips: 0,
        consecutive_failures: 0,
        last_error: null,
      },
    };

    state.context.inputs['intent'] = intent;
    if (options.inputs) Object.assign(state.context.inputs, options.inputs);

    this.activeState = state;
    this.emit({ type: 'walker:started', session_id: sessionId, graph_id: graphId, intent });

    if (options.dryRun) return this.dryRunWalk(state, graph);
    return this.walkGraph(state, graph);
  }

  async resume(sessionId?: string): Promise<WalkerState> {
    const state = this.loadState(sessionId);
    this.activeState = state;
    const graph = await this.loader.load(state.graph_id);
    state.status = 'running';
    return this.walkGraph(state, graph);
  }

  /** Load session state without executing — for status queries. */
  getState(sessionId?: string): WalkerState {
    return this.loadState(sessionId);
  }

  /** Continue a step_paused session — execute next command node, then pause again. */
  async next(sessionId?: string): Promise<WalkerState> {
    const state = this.loadState(sessionId);
    if (state.status !== 'step_paused') {
      throw new Error(`Cannot advance: session status is '${state.status}', expected 'step_paused'`);
    }
    this.activeState = state;
    state.status = 'running';
    const graph = await this.loader.load(state.graph_id);
    return this.walkGraph(state, graph);
  }

  async stop(): Promise<void> {
    await this.executor.abort();
    if (this.activeState) {
      this.activeState.status = 'paused';
      this.activeState.updated_at = new Date().toISOString();
      this.save(this.activeState);
    }
  }

  async walkGraph(state: WalkerState, graph: ChainGraph): Promise<WalkerState> {
    this.activeState = state;
    await this.walk(state, graph);
    return state;
  }

  private async walk(state: WalkerState, graph: ChainGraph): Promise<void> {
    while (state.status === 'running') {
      const nodeId = state.current_node;
      const node = graph.nodes[nodeId];
      if (!node) {
        state.status = 'failed';
        this.emit({ type: 'walker:error', session_id: state.session_id, error: `Node not found: ${nodeId}` });
        break;
      }

      // Visit count guard
      const maxVisits = (node as CommandNode).max_visits ?? graph.defaults?.max_visits ?? 10;
      const currentVisits = state.context.visits[nodeId] ?? 0;
      if (currentVisits >= maxVisits) {
        const cmdNode = node as CommandNode;
        if (node.type === 'command' && cmdNode.on_failure) {
          state.current_node = cmdNode.on_failure;
          continue;
        }
        state.status = 'failed';
        this.emit({ type: 'walker:error', session_id: state.session_id, error: `Max visits (${maxVisits}) exceeded for ${nodeId}` });
        break;
      }

      // Record visit
      state.context.visits[nodeId] = currentVisits + 1;
      const entry: HistoryEntry = {
        node_id: nodeId,
        node_type: node.type,
        entered_at: new Date().toISOString(),
      };
      state.history.push(entry);
      this.emit({ type: 'walker:node_enter', session_id: state.session_id, node_id: nodeId, node_type: node.type });

      // Dispatch by type
      switch (node.type) {
        case 'command':
          await this.handleCommand(state, graph, nodeId, node, entry);
          break;
        case 'decision':
          this.handleDecision(state, nodeId, node);
          break;
        case 'gate':
          this.handleGate(state, node, entry);
          break;
        case 'eval':
          this.handleEval(state, node);
          break;
        case 'fork':
          await this.handleFork(state, graph, node);
          break;
        case 'join':
          this.handleJoin(state, node);
          break;
        case 'terminal':
          await this.handleTerminal(state, graph, nodeId, node);
          break;
      }

      entry.exited_at = new Date().toISOString();
      this.emit({ type: 'walker:node_exit', session_id: state.session_id, node_id: nodeId, outcome: entry.outcome ?? 'success' });

      // Step mode: pause after each command node execution
      if (state.step_mode && node.type === 'command' && state.status === 'running') {
        state.status = 'step_paused';
      }

      state.updated_at = new Date().toISOString();
      this.save(state);

      if (state.status === 'step_paused') break;

      // Bail if status changed to non-running (waiting, paused, completed, failed)
      if (state.status !== 'running') break;
    }
  }

  private async handleCommand(
    state: WalkerState, graph: ChainGraph,
    nodeId: string, node: CommandNode, entry: HistoryEntry,
  ): Promise<void> {
    const prevCmd = this.findPreviousCommand(state);
    const cmdIndex = this.countCommandsBefore(state, nodeId) + 1;
    const cmdTotal = this.countCommandNodes(graph);

    const assembleReq: AssembleRequest = {
      node,
      node_id: nodeId,
      context: state.context,
      graph: { id: graph.id, name: graph.name },
      command_index: cmdIndex,
      command_total: cmdTotal,
      auto_mode: state.auto_mode,
      previous_command: prevCmd,
    };

    const prompt = await this.assembler.assemble(assembleReq);

    state.status = 'waiting_command';
    this.save(state);
    this.emit({ type: 'walker:command', session_id: state.session_id, node_id: nodeId, cmd: node.cmd, status: 'spawned' });

    const retryPolicy = this.resolveRetryPolicy(state, graph, node);
    const execution = await this.executeWithRetry(
      state,
      retryPolicy,
      async () => this.executor.execute({
        prompt,
        agent_type: (state.tool as AgentType) || 'claude',
        work_dir: (state.context.inputs['workflowRoot'] as string) ?? '.',
        approval_mode: state.auto_mode ? 'auto' : 'suggest',
        timeout_ms: node.timeout_ms ?? graph.defaults?.timeout_ms ?? 300000,
        node_id: nodeId,
        cmd: node.cmd,
      }),
    );
    const execResult = execution.result;
    const parsed = this.outputParser.parse(execResult.raw_output, node);
    state.context.result = parsed.structured as unknown as Record<string, unknown>;

    // Analyze if applicable
    let analysis = null;
    const shouldAnalyze = node.analyze !== false
      && (graph.defaults?.analyze !== false)
      && this.countCommandNodes(graph) > 1
      && this.analyzer !== null;
    if (shouldAnalyze && this.analyzer) {
      const analysisResult = await this.analyzer.analyze(node, execResult.raw_output, state.context, prevCmd);
      state.context.analysis = analysisResult as unknown as Record<string, unknown>;
      analysis = analysisResult;
    } else {
      state.context.analysis = null;
    }

    entry.exec_id = execResult.exec_id;
    entry.quality_score = analysis ? analysis.quality_score : undefined;
    entry.summary = (parsed.structured.summary as string) || undefined;
    entry.retry_count = execution.retries;

    if (execResult.success && parsed.structured.status === 'SUCCESS') {
      entry.outcome = 'success';
      this.ensureRecoveryState(state).consecutive_failures = 0;
      state.current_node = node.next;
      state.status = 'running';
      this.emit({ type: 'walker:command', session_id: state.session_id, node_id: nodeId, cmd: node.cmd, status: 'completed' });
    } else {
      entry.outcome = 'failure';
      const recovery = this.ensureRecoveryState(state);
      recovery.total_failures += 1;
      recovery.consecutive_failures += 1;
      recovery.last_error = this.buildFailureMessage(execResult, parsed.structured.summary);
      entry.error_message = recovery.last_error ?? undefined;
      if (node.on_failure) {
        state.current_node = node.on_failure;
        state.status = 'running';
      } else if (this.shouldAutoContinueOnFailure(state, graph, node)) {
        recovery.auto_skips += 1;
        state.current_node = node.next;
        state.status = 'running';
        entry.outcome = 'skipped';
      } else {
        state.status = 'failed';
      }
      this.emit({ type: 'walker:command', session_id: state.session_id, node_id: nodeId, cmd: node.cmd, status: 'failed' });
    }
  }

  private handleDecision(state: WalkerState, nodeId: string, node: DecisionNode): void {
    const strategy = node.strategy ?? 'expr';

    if (strategy === 'llm') {
      // LLM strategy: fallback to first default edge
      const defaultEdge = node.edges.find(e => e.default);
      if (defaultEdge) {
        state.current_node = defaultEdge.target;
      } else {
        state.status = 'failed';
      }
      return;
    }

    // expr strategy
    const resolvedValue = node.eval ? this.evaluator.resolve(node.eval, state.context) : undefined;
    let matched = false;
    for (const edge of node.edges) {
      if (this.evaluator.match(edge, resolvedValue, state.context)) {
        state.current_node = edge.target;
        matched = true;
        this.emit({ type: 'walker:decision', session_id: state.session_id, node_id: nodeId, resolved_value: resolvedValue, target: edge.target });
        break;
      }
    }
    if (!matched) {
      state.status = 'failed';
      this.emit({ type: 'walker:error', session_id: state.session_id, error: `No matching edge in decision ${nodeId}` });
    }
  }

  private handleGate(state: WalkerState, node: GateNode, entry: HistoryEntry): void {
    const passed = this.evaluator.evaluate(node.condition, state.context);
    if (passed) {
      state.current_node = node.on_pass;
      entry.outcome = 'success';
    } else if (node.wait) {
      if (state.auto_mode) {
        state.current_node = node.on_fail;
        entry.outcome = 'failure';
      } else {
        state.status = 'waiting_gate';
        entry.outcome = 'skipped';
        this.save(state);
      }
    } else {
      state.current_node = node.on_fail;
      entry.outcome = 'failure';
    }
  }

  private handleEval(state: WalkerState, node: EvalNode): void {
    for (const [key, expr] of Object.entries(node.set)) {
      const value = this.evaluator.resolve(expr, state.context);
      this.setContextValue(state.context, key, value);
    }
    state.current_node = node.next;
  }

  private async handleFork(state: WalkerState, graph: ChainGraph, node: ForkNode): Promise<void> {
    // Validate all branch nodes exist
    for (const branch of node.branches) {
      if (!graph.nodes[branch]) {
        state.status = 'failed';
        this.emit({ type: 'walker:error', session_id: state.session_id, error: `Fork branch node not found: ${branch}` });
        return;
      }
    }

    // Initialize fork_state keyed by current fork node ID
    const forkNodeId = state.current_node;
    const branchStates: Record<string, 'pending' | 'running' | 'completed' | 'failed'> = {};
    for (const branch of node.branches) {
      branchStates[branch] = 'pending';
    }
    if (!state.fork_state) state.fork_state = {};
    state.fork_state[forkNodeId] = {
      branches: branchStates,
      join_node: node.join,
      results: {},
    };

    this.emit({ type: 'walker:fork_start', session_id: state.session_id, node_id: forkNodeId, branches: node.branches });

    const forkEntry = state.fork_state[forkNodeId];

    if (this.parallelExecutor) {
      // Parallel execution via injected executor
      const workDir = (state.context.inputs['workflowRoot'] as string) ?? '.';
      const agentType = (state.tool as AgentType) || 'claude';

      const branchTasks = node.branches.map((branchId) => {
        const branchNode = graph.nodes[branchId] as CommandNode;
        return {
          branchId,
          nodeId: branchId,
          prompt: branchNode.type === 'command' ? branchNode.cmd : branchId,
          workDir,
          agentType,
        };
      });

      // Mark all branches running
      for (const branch of node.branches) {
        forkEntry.branches[branch] = 'running';
      }

      const joinNode = graph.nodes[node.join] as JoinNode | undefined;
      const strategy = joinNode?.strategy ?? 'all';

      const results = await this.parallelExecutor.executeBranches(branchTasks, strategy);

      // Update branch states and store results
      for (const result of results) {
        forkEntry.branches[result.branchId] = result.success ? 'completed' : 'failed';
        forkEntry.results[result.branchId] = { output: result.output, success: result.success, durationMs: result.durationMs };
        state.context.visits[result.branchId] = (state.context.visits[result.branchId] ?? 0) + 1;
        this.emit({ type: 'walker:branch_complete', session_id: state.session_id, node_id: forkNodeId, branch_id: result.branchId, success: result.success });
      }
    } else {
      // Sequential fallback — visit each branch entry, record visit
      for (const branch of node.branches) {
        forkEntry.branches[branch] = 'running';
        state.context.visits[branch] = (state.context.visits[branch] ?? 0) + 1;
        forkEntry.branches[branch] = 'completed';
        forkEntry.results[branch] = { output: '', success: true, durationMs: 0 };
        this.emit({ type: 'walker:branch_complete', session_id: state.session_id, node_id: forkNodeId, branch_id: branch, success: true });
      }
    }

    state.current_node = node.join;
  }

  private handleJoin(state: WalkerState, node: JoinNode): void {
    if (!state.fork_state) {
      // No fork state — just proceed (backward compat)
      state.current_node = node.next;
      return;
    }

    // Find the fork entry that references this join node
    const joinNodeId = state.current_node;
    let forkKey: string | undefined;
    for (const [key, entry] of Object.entries(state.fork_state)) {
      if (entry.join_node === joinNodeId) {
        forkKey = key;
        break;
      }
    }

    if (!forkKey) {
      // No matching fork — just proceed
      state.current_node = node.next;
      return;
    }

    const forkEntry = state.fork_state[forkKey];

    // Evaluate join strategy
    const branches = forkEntry.branches;
    const branchIds = Object.keys(branches);
    const completedCount = branchIds.filter((id) => branches[id] === 'completed').length;
    const totalCount = branchIds.length;

    let joinSuccess: boolean;
    switch (node.strategy) {
      case 'all':
        joinSuccess = completedCount === totalCount;
        break;
      case 'any':
        joinSuccess = completedCount >= 1;
        break;
      case 'majority':
        joinSuccess = completedCount > totalCount / 2;
        break;
      default:
        joinSuccess = completedCount === totalCount;
    }

    // Apply merge mode to aggregate branch results
    const mergeMode = node.merge ?? 'concat';
    const branchResults = forkEntry.results;

    switch (mergeMode) {
      case 'concat': {
        const outputs: string[] = [];
        for (const id of branchIds) {
          const br = branchResults[id] as { output?: string } | undefined;
          if (br?.output) outputs.push(br.output);
        }
        state.context.result = { merged: outputs.join('\n'), branches: branchResults };
        break;
      }
      case 'last': {
        const lastId = branchIds[branchIds.length - 1];
        const lastResult = branchResults[lastId] as Record<string, unknown> | undefined;
        state.context.result = lastResult ? { ...lastResult, branches: branchResults } : { branches: branchResults };
        break;
      }
      case 'best_score': {
        // Pick the first successful branch; fall back to first branch
        let bestId = branchIds[0];
        for (const id of branchIds) {
          if (branches[id] === 'completed') {
            bestId = id;
            break;
          }
        }
        const bestResult = branchResults[bestId] as Record<string, unknown> | undefined;
        state.context.result = bestResult ? { ...bestResult, branches: branchResults } : { branches: branchResults };
        break;
      }
    }

    this.emit({ type: 'walker:join_complete', session_id: state.session_id, node_id: state.current_node, strategy: node.strategy, success: joinSuccess });

    // Clear fork state for this fork
    delete state.fork_state[forkKey];
    if (Object.keys(state.fork_state).length === 0) {
      state.fork_state = null;
    }

    if (joinSuccess) {
      state.current_node = node.next;
    } else {
      state.status = 'failed';
      this.emit({ type: 'walker:error', session_id: state.session_id, error: `Join strategy '${node.strategy}' not satisfied: ${completedCount}/${totalCount} branches completed` });
    }
  }

  private async handleTerminal(
    state: WalkerState, graph: ChainGraph,
    nodeId: string, node: TerminalNode,
  ): Promise<void> {
    if (node.status === 'delegate' && node.delegate_graph) {
      // Push current frame
      state.delegate_stack.push({
        parent_graph_id: state.graph_id,
        parent_node_id: nodeId,
        return_inputs: { ...state.context.inputs },
      });

      this.emit({ type: 'walker:delegate', session_id: state.session_id, from_graph: state.graph_id, to_graph: node.delegate_graph });

      const newGraph = await this.loader.load(node.delegate_graph);

      // Merge delegate_inputs
      if (node.delegate_inputs) {
        for (const [key, tmpl] of Object.entries(node.delegate_inputs)) {
          state.context.inputs[key] = this.resolveTemplate(tmpl, state.context);
        }
      }

      state.graph_id = node.delegate_graph;
      state.current_node = newGraph.entry;
      await this.walk(state, newGraph);

      // After delegate completes, pop frame and return to parent
      if (state.delegate_stack.length > 0 && (state.status === 'completed' || state.status === 'failed')) {
        const frame = state.delegate_stack.pop()!;
        state.graph_id = frame.parent_graph_id;
        Object.assign(state.context.inputs, frame.return_inputs);
      }
      return;
    }

    // Non-delegate terminal
    if (node.status === 'success') {
      if (state.delegate_stack.length > 0) {
        const frame = state.delegate_stack.pop()!;
        state.graph_id = frame.parent_graph_id;
        Object.assign(state.context.inputs, frame.return_inputs);
        state.status = 'completed';
      } else {
        state.status = 'completed';
      }
    } else if (node.status === 'failure') {
      state.status = 'failed';
    } else if (node.status === 'paused') {
      state.status = 'paused';
    }

    const historySummary = state.history
      .filter(h => h.summary)
      .map(h => `${h.node_id}: ${h.summary}`);
    this.emit({
      type: 'walker:completed',
      session_id: state.session_id,
      status: state.status === 'completed' ? 'success' : 'failure',
      history_summary: historySummary,
    });
  }

  private countCommandNodes(graph: ChainGraph): number {
    return Object.values(graph.nodes).filter(n => n.type === 'command').length;
  }

  private countCommandsBefore(state: WalkerState, _nodeId: string): number {
    const seen = new Set<string>();
    for (const entry of state.history) {
      if (entry.node_type === 'command') seen.add(entry.node_id);
    }
    seen.delete(_nodeId);
    return seen.size;
  }

  private findPreviousCommand(state: WalkerState): AssembleRequest['previous_command'] | undefined {
    for (let i = state.history.length - 1; i >= 0; i--) {
      const h = state.history[i];
      if (h.node_type === 'command' && h.outcome) {
        return {
          node_id: h.node_id,
          cmd: h.node_id,
          outcome: h.outcome === 'skipped' ? 'failure' : h.outcome,
          summary: h.summary,
        };
      }
    }
    return undefined;
  }

  private setContextValue(ctx: WalkerContext, path: string, value: unknown): void {
    const parts = path.split('.');
    if (parts.length === 1) {
      (ctx.var as Record<string, unknown>)[parts[0]] = value;
      return;
    }

    const root = parts[0];
    const rest = parts.slice(1);
    let target: Record<string, unknown>;

    switch (root) {
      case 'inputs': target = ctx.inputs as Record<string, unknown>; break;
      case 'var': target = ctx.var as Record<string, unknown>; break;
      case 'result': target = (ctx.result ?? {}) as Record<string, unknown>; ctx.result = target; break;
      default: target = ctx.var as Record<string, unknown>; rest.unshift(root); break;
    }

    for (let i = 0; i < rest.length - 1; i++) {
      const key = rest[i];
      if (!(key in target) || typeof target[key] !== 'object' || target[key] === null) {
        target[key] = {};
      }
      target = target[key] as Record<string, unknown>;
    }
    target[rest[rest.length - 1]] = value;
  }

  private resolveTemplate(template: string, ctx: WalkerContext): string {
    return template.replace(/\{([^}]+)\}/g, (_match, key: string) => {
      const value = this.evaluator.resolve(key.trim(), ctx);
      return value !== undefined ? String(value) : `{${key}}`;
    });
  }

  private buildInitialContext(options: StartOptions): WalkerContext {
    let project: ProjectSnapshot = {
      initialized: false,
      current_phase: null,
      phase_status: 'pending',
      artifacts: {},
      execution: { tasks_completed: 0, tasks_total: 0 },
      verification_status: 'pending',
      review_verdict: null,
      uat_status: 'pending',
      phases_total: 0,
      phases_completed: 0,
      accumulated_context: null,
    };

    try {
      const stateFile = join(options.workflowRoot, '.workflow', 'state.json');
      const raw = JSON.parse(readFileSync(stateFile, 'utf-8'));
      if (raw && typeof raw === 'object') {
        project = { ...project, ...raw, initialized: true };
      }
    } catch { /* no state file */ }

    return {
      inputs: {
        workflowRoot: options.workflowRoot,
        phase: project.current_phase != null ? String(project.current_phase) : '',
      },
      project,
      result: null,
      analysis: null,
      visits: {},
      var: {},
    };
  }

  private save(state: WalkerState): void {
    if (!this.sessionDir) return;
    try {
      const dir = join(this.sessionDir, state.session_id);
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, 'walker-state.json'),
        JSON.stringify(state, null, 2),
        'utf-8',
      );
    } catch (error) {
      const recovery = this.ensureRecoveryState(state);
      recovery.last_error = `persist_failed: ${error instanceof Error ? error.message : String(error)}`;
      this.emit({ type: 'walker:error', session_id: state.session_id, error: recovery.last_error });
    }
  }

  private loadState(sessionId?: string): WalkerState {
    if (!this.sessionDir) throw new Error('No sessionDir configured for resume');

    if (sessionId) {
      const filePath = join(this.sessionDir, sessionId, 'walker-state.json');
      try {
        const loaded = JSON.parse(readFileSync(filePath, 'utf-8')) as WalkerState;
        this.hydrateRecoveryState(loaded);
        return loaded;
      } catch {
        throw new Error(`Session not found: ${sessionId} (expected ${filePath})`);
      }
    }

    let entries;
    try {
      entries = readdirSync(this.sessionDir, { withFileTypes: true });
    } catch {
      throw new Error(`No sessions directory at ${this.sessionDir}`);
    }
    const dirs = entries
      .filter(e => e.isDirectory() && e.name.startsWith('coord-'))
      .map(e => e.name)
      .sort()
      .reverse();

    if (dirs.length === 0) throw new Error('No walker sessions found');

    const filePath = join(this.sessionDir, dirs[0], 'walker-state.json');
    const loaded = JSON.parse(readFileSync(filePath, 'utf-8')) as WalkerState;
    this.hydrateRecoveryState(loaded);
    return loaded;
  }

  private dryRunWalk(state: WalkerState, graph: ChainGraph): WalkerState {
    const visited: string[] = [];
    let current = state.current_node;
    const seen = new Set<string>();

    while (current && !seen.has(current)) {
      seen.add(current);
      const node = graph.nodes[current];
      if (!node) break;

      visited.push(`${current} (${node.type})`);

      switch (node.type) {
        case 'command': current = node.next; break;
        case 'decision': current = node.edges[0]?.target ?? ''; break;
        case 'gate': current = node.on_pass; break;
        case 'eval': current = node.next; break;
        case 'fork': current = node.join; break;
        case 'join': current = node.next; break;
        case 'terminal': current = ''; break;
      }
    }

    state.status = 'completed';
    state.context.var['dry_run_plan'] = visited;
    return state;
  }

  private emit(event: CoordinateEvent): void {
    this.emitter?.emit(event);
  }

  private ensureRecoveryState(state: WalkerState): NonNullable<WalkerState['recovery']> {
    if (!state.recovery) {
      state.recovery = {
        total_retries: 0,
        total_failures: 0,
        auto_skips: 0,
        consecutive_failures: 0,
        last_error: null,
      };
    }
    return state.recovery;
  }

  private hydrateRecoveryState(state: WalkerState): void {
    this.ensureRecoveryState(state);
  }

  private resolveRetryPolicy(state: WalkerState, graph: ChainGraph, node: CommandNode): Required<RetryPolicy> {
    const fromNode = node.retry ?? {};
    const fromGraph = graph.defaults?.retry ?? {};
    const auto = state.auto_mode;
    const maxAttempts = fromNode.max_attempts
      ?? fromGraph.max_attempts
      ?? (auto ? 3 : 1);
    const baseBackoff = fromNode.base_backoff_ms
      ?? fromGraph.base_backoff_ms
      ?? 500;
    const maxBackoff = fromNode.max_backoff_ms
      ?? fromGraph.max_backoff_ms
      ?? 4000;
    return {
      max_attempts: Math.max(1, maxAttempts),
      base_backoff_ms: Math.max(0, baseBackoff),
      max_backoff_ms: Math.max(0, maxBackoff),
    };
  }

  private async executeWithRetry(
    state: WalkerState,
    retryPolicy: Required<RetryPolicy>,
    exec: () => Promise<{ success: boolean; raw_output: string; exec_id: string; duration_ms: number }>,
  ): Promise<{ result: { success: boolean; raw_output: string; exec_id: string; duration_ms: number }; retries: number }> {
    let attempt = 0;
    let retries = 0;
    while (attempt < retryPolicy.max_attempts) {
      const result = await exec();
      let parsedStatus: string | null = null;
      try {
        const parsed = this.outputParser.parse(result.raw_output, { type: 'command', cmd: '', next: '' });
        parsedStatus = parsed.structured.status;
      } catch {
        parsedStatus = null;
      }
      const success = result.success && parsedStatus === 'SUCCESS';
      if (success) {
        return { result, retries };
      }
      attempt += 1;
      if (attempt >= retryPolicy.max_attempts) {
        return { result, retries };
      }
      retries += 1;
      const recovery = this.ensureRecoveryState(state);
      recovery.total_retries += 1;
      const backoff = Math.min(
        retryPolicy.max_backoff_ms,
        retryPolicy.base_backoff_ms * Math.pow(2, retries - 1),
      );
      if (backoff > 0) {
        await this.delay(backoff);
      }
    }
    const fallback = await exec();
    return { result: fallback, retries };
  }

  private shouldAutoContinueOnFailure(state: WalkerState, graph: ChainGraph, node: CommandNode): boolean {
    if (!state.auto_mode) return false;
    if (!node.next) return false;
    if (node.auto_continue_on_failure === true) return true;
    if (node.auto_continue_on_failure === false) return false;
    return graph.defaults?.auto_continue_on_failure ?? true;
  }

  private buildFailureMessage(execResult: { success: boolean; raw_output: string }, summary?: unknown): string {
    const statusPart = execResult.success ? 'exec_success_parse_failure' : 'exec_failure';
    const summaryText = typeof summary === 'string' && summary.length > 0
      ? summary
      : execResult.raw_output.split('\n').slice(-3).join(' | ').slice(0, 400);
    return `${statusPart}: ${summaryText}`;
  }

  private async delay(ms: number): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
  }
}
