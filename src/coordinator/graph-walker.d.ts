import type { ChainGraph, WalkerState, CommandExecutor, PromptAssembler, ExprEvaluator, OutputParser, StepAnalyzer, WalkerEventEmitter } from './graph-types.js';
import type { GraphLoader } from './graph-loader.js';
export interface StartOptions {
    tool: string;
    autoMode: boolean;
    dryRun?: boolean;
    stepMode?: boolean;
    workflowRoot: string;
    inputs?: Record<string, unknown>;
}
export declare class GraphWalker {
    private readonly loader;
    private readonly assembler;
    private readonly executor;
    private readonly analyzer;
    private readonly outputParser;
    private readonly evaluator;
    private readonly emitter?;
    private readonly sessionDir?;
    private activeState;
    constructor(loader: GraphLoader, assembler: PromptAssembler, executor: CommandExecutor, analyzer: StepAnalyzer | null, outputParser: OutputParser, evaluator: ExprEvaluator, emitter?: WalkerEventEmitter | undefined, sessionDir?: string | undefined);
    start(graphId: string, intent: string, options: StartOptions): Promise<WalkerState>;
    resume(sessionId?: string): Promise<WalkerState>;
    /** Load session state without executing — for status queries. */
    getState(sessionId?: string): WalkerState;
    /** Continue a step_paused session — execute next command node, then pause again. */
    next(sessionId?: string): Promise<WalkerState>;
    stop(): Promise<void>;
    walkGraph(state: WalkerState, graph: ChainGraph): Promise<WalkerState>;
    private walk;
    private handleCommand;
    private handleDecision;
    private handleGate;
    private handleEval;
    private handleFork;
    private handleJoin;
    private handleTerminal;
    private countCommandNodes;
    private countCommandsBefore;
    private findPreviousCommand;
    private setContextValue;
    private resolveTemplate;
    private buildInitialContext;
    private save;
    private loadState;
    private dryRunWalk;
    private emit;
}
