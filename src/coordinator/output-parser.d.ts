import type { CommandNode, OutputParser, ParsedResult } from './graph-types.js';
export declare class DefaultOutputParser implements OutputParser {
    parse(rawOutput: string, node: CommandNode): ParsedResult;
}
