import type { AssembleRequest, CommandNode, ProjectSnapshot, PromptAssembler, WalkerContext } from './graph-types.js';
export declare class DefaultPromptAssembler implements PromptAssembler {
    private readonly workflowRoot;
    private readonly templateDir;
    constructor(workflowRoot: string, templateDir: string);
    assemble(req: AssembleRequest): Promise<string>;
    resolveArgs(args: string, ctx: WalkerContext): string;
    private resolveKey;
    buildCommand(node: CommandNode, resolvedArgs: string, autoMode: boolean): string;
    buildPreviousContext(req: AssembleRequest): string;
    buildStateSnapshot(project: ProjectSnapshot): string;
    private loadTemplate;
    renderTemplate(template: string, vars: Record<string, string>): string;
}
