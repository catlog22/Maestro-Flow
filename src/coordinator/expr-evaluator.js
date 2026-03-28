// Graph Coordinator — Expression Evaluator
// Tokenizer + recursive descent parser + AST evaluator.
// No eval(), no new Function(). Pure custom parser.
export class ExprSyntaxError extends Error {
    expr;
    constructor(message, expr) {
        super(`Expression syntax error: ${message} in "${expr}"`);
        this.expr = expr;
        this.name = 'ExprSyntaxError';
    }
}
function tokenize(input) {
    const tokens = [];
    let i = 0;
    const src = input;
    while (i < src.length) {
        const ch = src[i];
        if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
            i++;
            continue;
        }
        // Two-char operators
        if (i + 1 < src.length) {
            const two = src.slice(i, i + 2);
            if (two === '==') {
                tokens.push({ type: 'Eq', value: '==' });
                i += 2;
                continue;
            }
            if (two === '!=') {
                tokens.push({ type: 'Neq', value: '!=' });
                i += 2;
                continue;
            }
            if (two === '>=') {
                tokens.push({ type: 'Gte', value: '>=' });
                i += 2;
                continue;
            }
            if (two === '<=') {
                tokens.push({ type: 'Lte', value: '<=' });
                i += 2;
                continue;
            }
            if (two === '&&') {
                tokens.push({ type: 'And', value: '&&' });
                i += 2;
                continue;
            }
            if (two === '||') {
                tokens.push({ type: 'Or', value: '||' });
                i += 2;
                continue;
            }
        }
        // Single-char
        if (ch === '>') {
            tokens.push({ type: 'Gt', value: '>' });
            i++;
            continue;
        }
        if (ch === '<') {
            tokens.push({ type: 'Lt', value: '<' });
            i++;
            continue;
        }
        if (ch === '!') {
            tokens.push({ type: 'Not', value: '!' });
            i++;
            continue;
        }
        if (ch === '(') {
            tokens.push({ type: 'LParen', value: '(' });
            i++;
            continue;
        }
        if (ch === ')') {
            tokens.push({ type: 'RParen', value: ')' });
            i++;
            continue;
        }
        if (ch === '.') {
            tokens.push({ type: 'Dot', value: '.' });
            i++;
            continue;
        }
        // String literal
        if (ch === '"' || ch === "'") {
            const quote = ch;
            let str = '';
            i++;
            while (i < src.length && src[i] !== quote) {
                if (src[i] === '\\' && i + 1 < src.length) {
                    str += src[i + 1];
                    i += 2;
                }
                else {
                    str += src[i];
                    i++;
                }
            }
            if (i >= src.length)
                throw new ExprSyntaxError(`Unterminated string`, input);
            i++;
            tokens.push({ type: 'String', value: str });
            continue;
        }
        // Number
        if (ch >= '0' && ch <= '9') {
            let num = '';
            while (i < src.length && ((src[i] >= '0' && src[i] <= '9') || src[i] === '.')) {
                num += src[i];
                i++;
            }
            tokens.push({ type: 'Number', value: num });
            continue;
        }
        // Identifier / keyword
        if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_') {
            let id = '';
            while (i < src.length && /[a-zA-Z0-9_]/.test(src[i])) {
                id += src[i];
                i++;
            }
            if (id === 'true' || id === 'false')
                tokens.push({ type: 'Boolean', value: id });
            else if (id === 'null')
                tokens.push({ type: 'Null', value: 'null' });
            else
                tokens.push({ type: 'Ident', value: id });
            continue;
        }
        throw new ExprSyntaxError(`Unexpected character '${ch}'`, input);
    }
    tokens.push({ type: 'EOF', value: '' });
    return tokens;
}
// -- Parser (recursive descent) --
class Parser {
    tokens;
    input;
    pos = 0;
    constructor(tokens, input) {
        this.tokens = tokens;
        this.input = input;
    }
    peek() { return this.tokens[this.pos]; }
    advance() { return this.tokens[this.pos++]; }
    expect(type) {
        const t = this.peek();
        if (t.type !== type)
            throw new ExprSyntaxError(`Expected ${type}, got ${t.type}`, this.input);
        return this.advance();
    }
    parse() {
        const node = this.parseOr();
        if (this.peek().type !== 'EOF')
            throw new ExprSyntaxError(`Unexpected token '${this.peek().value}'`, this.input);
        return node;
    }
    parseOr() {
        let left = this.parseAnd();
        while (this.peek().type === 'Or') {
            this.advance();
            left = { kind: 'binary', op: '||', left, right: this.parseAnd() };
        }
        return left;
    }
    parseAnd() {
        let left = this.parseComparison();
        while (this.peek().type === 'And') {
            this.advance();
            left = { kind: 'binary', op: '&&', left, right: this.parseComparison() };
        }
        return left;
    }
    parseComparison() {
        let left = this.parseUnary();
        const cmpTypes = ['Eq', 'Neq', 'Gt', 'Gte', 'Lt', 'Lte'];
        if (cmpTypes.includes(this.peek().type)) {
            const op = this.advance().value;
            left = { kind: 'binary', op, left, right: this.parseUnary() };
        }
        return left;
    }
    parseUnary() {
        if (this.peek().type === 'Not') {
            this.advance();
            return { kind: 'unary', op: '!', operand: this.parseUnary() };
        }
        return this.parsePrimary();
    }
    parsePrimary() {
        const t = this.peek();
        if (t.type === 'LParen') {
            this.advance();
            const node = this.parseOr();
            this.expect('RParen');
            return node;
        }
        if (t.type === 'String') {
            this.advance();
            return { kind: 'literal', value: t.value };
        }
        if (t.type === 'Number') {
            this.advance();
            return { kind: 'literal', value: Number(t.value) };
        }
        if (t.type === 'Boolean') {
            this.advance();
            return { kind: 'literal', value: t.value === 'true' };
        }
        if (t.type === 'Null') {
            this.advance();
            return { kind: 'literal', value: null };
        }
        if (t.type === 'Ident') {
            const segments = [this.advance().value];
            while (this.peek().type === 'Dot') {
                this.advance();
                segments.push(this.expect('Ident').value);
            }
            return { kind: 'path', segments };
        }
        throw new ExprSyntaxError(`Unexpected token '${t.value}'`, this.input);
    }
}
// -- Path resolution --
function resolvePath(segments, ctx) {
    let segs = segments;
    if (segs[0] === 'ctx')
        segs = segs.slice(1);
    if (segs.length === 0)
        return undefined;
    const root = segs[0];
    const rest = segs.slice(1);
    let target;
    switch (root) {
        case 'inputs':
            target = ctx.inputs;
            break;
        case 'project':
            target = ctx.project;
            break;
        case 'result':
            target = ctx.result;
            break;
        case 'analysis':
            target = ctx.analysis;
            break;
        case 'visits': {
            if (rest.length === 0)
                return ctx.visits;
            const val = ctx.visits[rest[0]];
            let cur = val ?? 0;
            for (let j = 1; j < rest.length; j++) {
                if (cur == null || typeof cur !== 'object')
                    return undefined;
                cur = cur[rest[j]];
            }
            return cur;
        }
        case 'var':
            target = ctx.var;
            break;
        default: return undefined;
    }
    let cur = target;
    for (const seg of rest) {
        if (cur == null || typeof cur !== 'object')
            return undefined;
        cur = cur[seg];
    }
    return cur;
}
// -- AST evaluation --
function evalAst(node, ctx) {
    switch (node.kind) {
        case 'literal': return node.value;
        case 'path': return resolvePath(node.segments, ctx);
        case 'unary': return !toBool(evalAst(node.operand, ctx));
        case 'binary': return evalBinary(node.op, node.left, node.right, ctx);
    }
}
function evalBinary(op, left, right, ctx) {
    if (op === '&&')
        return toBool(evalAst(left, ctx)) && toBool(evalAst(right, ctx));
    if (op === '||')
        return toBool(evalAst(left, ctx)) || toBool(evalAst(right, ctx));
    const lv = evalAst(left, ctx);
    const rv = evalAst(right, ctx);
    switch (op) {
        // eslint-disable-next-line eqeqeq
        case '==': return lv == rv;
        // eslint-disable-next-line eqeqeq
        case '!=': return lv != rv;
        case '>': return toNum(lv) > toNum(rv);
        case '>=': return toNum(lv) >= toNum(rv);
        case '<': return toNum(lv) < toNum(rv);
        case '<=': return toNum(lv) <= toNum(rv);
        default: return false;
    }
}
function toBool(v) { return !!v; }
function toNum(v) {
    if (typeof v === 'number')
        return v;
    if (typeof v === 'string') {
        const n = Number(v);
        return Number.isNaN(n) ? 0 : n;
    }
    if (typeof v === 'boolean')
        return v ? 1 : 0;
    return 0;
}
// -- DefaultExprEvaluator --
export class DefaultExprEvaluator {
    resolve(expr, ctx) {
        const tokens = tokenize(expr);
        const ast = new Parser(tokens, expr).parse();
        if (ast.kind === 'path')
            return resolvePath(ast.segments, ctx);
        return evalAst(ast, ctx);
    }
    evaluate(expr, ctx) {
        const tokens = tokenize(expr);
        const ast = new Parser(tokens, expr).parse();
        return toBool(evalAst(ast, ctx));
    }
    match(edge, resolvedValue, ctx) {
        // Priority 1: exact value match
        if (edge.value !== undefined) {
            // eslint-disable-next-line eqeqeq
            return resolvedValue == edge.value;
        }
        // Priority 2: condition expression
        if (edge.match) {
            return this.evaluate(edge.match, ctx);
        }
        // Priority 3: label match (case-insensitive)
        if (edge.label !== undefined) {
            if (typeof resolvedValue === 'string') {
                return resolvedValue.toLowerCase() === edge.label.toLowerCase();
            }
            return String(resolvedValue) === edge.label;
        }
        // Priority 4: default
        return edge.default === true;
    }
}
//# sourceMappingURL=expr-evaluator.js.map