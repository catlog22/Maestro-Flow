import type { DecisionEdge, ExprEvaluator, WalkerContext } from './graph-types.js';
export declare class ExprSyntaxError extends Error {
    readonly expr: string;
    constructor(message: string, expr: string);
}
export declare class DefaultExprEvaluator implements ExprEvaluator {
    resolve(expr: string, ctx: WalkerContext): unknown;
    evaluate(expr: string, ctx: WalkerContext): boolean;
    match(edge: DecisionEdge, resolvedValue: unknown, ctx: WalkerContext): boolean;
}
