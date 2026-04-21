import { describe, it } from 'node:test';
import assert from 'node:assert';
import { evaluateSpecValidator } from '../guards/spec-validator.js';

describe('evaluateSpecValidator', () => {
  it('passes valid <spec-entry> content', () => {
    const content = `# Learnings

## Entries

<spec-entry category="learning" keywords="auth,token" date="2026-04-21">

### Token rotation

Content here.

</spec-entry>
`;
    const result = evaluateSpecValidator('.workflow/specs/learnings.md', content);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
  });

  it('skips non-spec files', () => {
    const result = evaluateSpecValidator('src/index.ts', 'any content');
    assert.strictEqual(result.valid, true);
  });

  it('reports unclosed tags', () => {
    const content = `
<spec-entry category="learning" keywords="test" date="2026-04-21">

### Unclosed

Content without closing tag.
`;
    const result = evaluateSpecValidator('.workflow/specs/learnings.md', content);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.message.includes('Unbalanced')));
  });

  it('reports category mismatch', () => {
    const content = `
<spec-entry category="arch" keywords="test" date="2026-04-21">

### Wrong category

This is in learnings.md but category says arch.

</spec-entry>
`;
    const result = evaluateSpecValidator('.workflow/specs/learnings.md', content);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.message.includes('does not match')));
  });

  it('reports missing required attributes', () => {
    const content = `
<spec-entry date="2026-04-21">

### Missing category and keywords

Content.

</spec-entry>
`;
    const result = evaluateSpecValidator('.workflow/specs/learnings.md', content);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.message.includes('category')));
    assert.ok(result.errors.some(e => e.message.includes('keywords')));
  });

  it('defaults to warn mode', () => {
    const content = `
<spec-entry keywords="test" date="bad-date">

### Bad entry

Content.

</spec-entry>
`;
    const result = evaluateSpecValidator('.workflow/specs/learnings.md', content);
    assert.strictEqual(result.mode, 'warn');
  });

  it('respects block mode', () => {
    const content = `
<spec-entry keywords="test" date="bad-date">

### Bad entry

Content.

</spec-entry>
`;
    const result = evaluateSpecValidator('.workflow/specs/learnings.md', content, 'block');
    assert.strictEqual(result.mode, 'block');
  });

  it('passes content with no <spec-entry> tags', () => {
    const content = `# Coding Conventions

## Formatting
- 2 spaces indentation
`;
    const result = evaluateSpecValidator('.workflow/specs/coding-conventions.md', content);
    assert.strictEqual(result.valid, true);
  });

  it('handles Windows paths', () => {
    const content = `
<spec-entry category="coding" keywords="test" date="2026-04-21">

### Entry

Content.

</spec-entry>
`;
    const result = evaluateSpecValidator('D:\\project\\.workflow\\specs\\coding-conventions.md', content);
    assert.strictEqual(result.valid, true);
  });
});
