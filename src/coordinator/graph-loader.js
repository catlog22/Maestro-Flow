// ---------------------------------------------------------------------------
// Graph Loader — loads, validates, and caches ChainGraph JSON files.
// ---------------------------------------------------------------------------
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------
export class GraphValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'GraphValidationError';
    }
}
// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------
const REQUIRED_FIELDS = ['id', 'name', 'version', 'entry', 'nodes'];
function validateGraph(raw, filePath) {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new GraphValidationError(`Invalid graph structure in ${filePath}: expected an object`);
    }
    const obj = raw;
    for (const field of REQUIRED_FIELDS) {
        if (!(field in obj) || obj[field] === undefined) {
            throw new GraphValidationError(`Missing required field "${field}" in ${filePath}`);
        }
    }
    if (typeof obj.nodes !== 'object' || obj.nodes === null || Array.isArray(obj.nodes)) {
        throw new GraphValidationError(`"nodes" must be an object in ${filePath}`);
    }
    const nodes = obj.nodes;
    const nodeIds = new Set(Object.keys(nodes));
    // entry must exist
    const entry = obj.entry;
    if (!nodeIds.has(entry)) {
        throw new GraphValidationError(`Entry node "${entry}" not found in nodes of ${filePath}`);
    }
    // Validate all node references
    for (const [nodeId, node] of Object.entries(nodes)) {
        if (node === null || typeof node !== 'object')
            continue;
        const n = node;
        validateNodeRefs(nodeId, n, nodeIds, filePath);
    }
    return raw;
}
function validateNodeRefs(nodeId, node, nodeIds, filePath) {
    const check = (field, target) => {
        if (!nodeIds.has(target)) {
            throw new GraphValidationError(`Node "${nodeId}" references non-existent node "${target}" via "${field}" in ${filePath}`);
        }
    };
    // next (command, join, eval)
    if (typeof node.next === 'string')
        check('next', node.next);
    // on_failure (command)
    if (typeof node.on_failure === 'string')
        check('on_failure', node.on_failure);
    // on_pass / on_fail (gate)
    if (typeof node.on_pass === 'string')
        check('on_pass', node.on_pass);
    if (typeof node.on_fail === 'string')
        check('on_fail', node.on_fail);
    // edges[].target (decision)
    if (Array.isArray(node.edges)) {
        for (const edge of node.edges) {
            if (edge && typeof edge === 'object' && typeof edge.target === 'string') {
                check('edges[].target', edge.target);
            }
        }
    }
    // branches + join (fork)
    if (Array.isArray(node.branches)) {
        for (const branch of node.branches) {
            if (typeof branch === 'string')
                check('branches[]', branch);
        }
    }
    if (node.type === 'fork' && typeof node.join === 'string') {
        check('join', node.join);
    }
}
// ---------------------------------------------------------------------------
// GraphLoader
// ---------------------------------------------------------------------------
export class GraphLoader {
    chainsRoot;
    cache = new Map();
    constructor(chainsRoot) {
        this.chainsRoot = chainsRoot;
    }
    async load(graphId) {
        const filePath = this.resolvePath(graphId);
        // Check mtime for cache
        let fileStat;
        try {
            fileStat = await stat(filePath);
        }
        catch {
            throw new GraphValidationError(`Graph file not found: ${filePath}`);
        }
        const mtime = fileStat.mtimeMs;
        const cached = this.cache.get(filePath);
        if (cached && cached.mtime === mtime) {
            return cached.graph;
        }
        let content;
        try {
            content = await readFile(filePath, 'utf-8');
        }
        catch {
            throw new GraphValidationError(`Failed to read graph file: ${filePath}`);
        }
        const graph = this.parseAndValidate(content, filePath);
        this.cache.set(filePath, { graph, mtime });
        return graph;
    }
    loadSync(graphId) {
        const filePath = this.resolvePath(graphId);
        let fileStat;
        try {
            fileStat = statSync(filePath);
        }
        catch {
            throw new GraphValidationError(`Graph file not found: ${filePath}`);
        }
        const mtime = fileStat.mtimeMs;
        const cached = this.cache.get(filePath);
        if (cached && cached.mtime === mtime) {
            return cached.graph;
        }
        let content;
        try {
            content = readFileSync(filePath, 'utf-8');
        }
        catch {
            throw new GraphValidationError(`Failed to read graph file: ${filePath}`);
        }
        const graph = this.parseAndValidate(content, filePath);
        this.cache.set(filePath, { graph, mtime });
        return graph;
    }
    listAll() {
        const results = [];
        this.walkDir(this.chainsRoot, results);
        return results.sort();
    }
    // -------------------------------------------------------------------------
    // Private
    // -------------------------------------------------------------------------
    resolvePath(graphId) {
        return join(this.chainsRoot, `${graphId}.json`);
    }
    parseAndValidate(content, filePath) {
        let raw;
        try {
            raw = JSON.parse(content);
        }
        catch {
            throw new GraphValidationError(`Invalid JSON in ${filePath}`);
        }
        return validateGraph(raw, filePath);
    }
    walkDir(dir, results) {
        let entries;
        try {
            entries = readdirSync(dir, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            if (entry.name.startsWith('_'))
                continue;
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory()) {
                this.walkDir(fullPath, results);
            }
            else if (entry.isFile() && entry.name.endsWith('.json')) {
                const rel = relative(this.chainsRoot, fullPath);
                // Convert to forward-slash graph ID without .json
                const graphId = rel.replace(/\.json$/, '').split(sep).join('/');
                results.push(graphId);
            }
        }
    }
}
//# sourceMappingURL=graph-loader.js.map