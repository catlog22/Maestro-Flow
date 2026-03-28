import type { GraphLoader } from './graph-loader.js';
export declare class IntentRouter {
    private readonly loader;
    private readonly chainsRoot;
    private intentMap;
    private loaded;
    constructor(loader: GraphLoader, chainsRoot: string);
    resolve(intent: string, forceGraph?: string): string;
    private getIntentMap;
}
