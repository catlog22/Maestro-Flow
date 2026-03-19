import { describe, it, expect } from 'vitest';
import { parseWorkflow } from './parseWorkflow.js';
import type { WorkflowStep } from './parseWorkflow.js';

describe('parseWorkflow', () => {
  it('returns empty array for empty content', () => {
    expect(parseWorkflow('')).toEqual([]);
  });

  it('returns empty array for content with no step headings', () => {
    expect(parseWorkflow('# Title\nSome text')).toEqual([]);
  });

  it('parses a single step with ### heading', () => {
    const content = '### Step 1: Initialize\nSet up the project.';
    const steps = parseWorkflow(content);
    expect(steps).toHaveLength(1);
    expect(steps[0].stepNumber).toBe(1);
    expect(steps[0].title).toBe('Initialize');
    expect(steps[0].body).toBe('Set up the project.');
  });

  it('parses multiple steps', () => {
    const content = `### Step 1: First
Body one.
### Step 2: Second
Body two.
### Step 3: Third
Body three.`;
    const steps = parseWorkflow(content);
    expect(steps).toHaveLength(3);
    expect(steps[0].stepNumber).toBe(1);
    expect(steps[1].stepNumber).toBe(2);
    expect(steps[2].stepNumber).toBe(3);
    expect(steps[0].title).toBe('First');
    expect(steps[2].title).toBe('Third');
  });

  it('handles ## heading level', () => {
    const content = '## Step 5: Config\nConfigure settings.';
    const steps = parseWorkflow(content);
    expect(steps).toHaveLength(1);
    expect(steps[0].stepNumber).toBe(5);
  });

  it('handles # heading level', () => {
    const content = '# Step 10: Deploy\nDeploy to prod.';
    const steps = parseWorkflow(content);
    expect(steps).toHaveLength(1);
    expect(steps[0].stepNumber).toBe(10);
  });

  it('handles step heading without colon', () => {
    const content = '### Step 1 Initialize\nBody.';
    const steps = parseWorkflow(content);
    expect(steps).toHaveLength(1);
    expect(steps[0].title).toBe('Initialize');
  });

  it('trims body whitespace', () => {
    const content = '### Step 1: Test\n\n  Body with spaces.  \n\n### Step 2: Next\nBody.';
    const steps = parseWorkflow(content);
    expect(steps[0].body).toBe('Body with spaces.');
  });

  it('captures body up to next heading', () => {
    const content = `### Step 1: First
Line 1.
Line 2.
### Step 2: Second
Line 3.`;
    const steps = parseWorkflow(content);
    expect(steps[0].body).toContain('Line 1.');
    expect(steps[0].body).toContain('Line 2.');
    expect(steps[0].body).not.toContain('Line 3.');
  });
});
