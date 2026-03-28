import type { ChainGraph } from './graph-types.js';
export declare class GraphValidationError extends Error {
    constructor(message: string);
}
export declare class GraphLoader {
    private readonly chainsRoot;
    private readonly cache;
    constructor(chainsRoot: string);
    load(graphId: string): Promise<ChainGraph>;
    loadSync(graphId: string): ChainGraph;
    listAll(): string[];
    private resolvePath;
    private parseAndValidate;
    private walkDir;
}
