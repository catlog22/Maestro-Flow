// ---------------------------------------------------------------------------
// parseWorkflow — extract Step N sections from workflow markdown content
// ---------------------------------------------------------------------------

export interface WorkflowStep {
  stepNumber: number;
  title: string;
  body: string;
}

/**
 * Parse a markdown workflow document into structured steps.
 * Matches headings of the form:
 *   ### Step 3: Title
 *   ## Step 3: Title
 *   # Step 3: Title
 * Body is the text between this heading and the next heading of any level.
 */
export function parseWorkflow(content: string): WorkflowStep[] {
  const headingRe = /^#{1,3}\s+Step\s+(\d+):?\s*(.*)$/gm;
  const steps: WorkflowStep[] = [];

  let match: RegExpExecArray | null;
  let prev: { stepNumber: number; title: string; end: number } | null = null;

  while ((match = headingRe.exec(content)) !== null) {
    const stepNumber = parseInt(match[1], 10);
    const title = match[2].trim();
    const headingStart = match.index;

    if (prev !== null) {
      // Body is everything between the previous heading line end and this heading start
      const bodyRaw = content.slice(prev.end, headingStart);
      steps.push({
        stepNumber: prev.stepNumber,
        title: prev.title,
        body: bodyRaw.trim(),
      });
    }

    // Record end of current heading line (match[0] length from match.index)
    const headingEnd = headingStart + match[0].length;
    prev = { stepNumber, title, end: headingEnd };
  }

  // Handle last step — body runs to end of document
  if (prev !== null) {
    const bodyRaw = content.slice(prev.end);
    steps.push({
      stepNumber: prev.stepNumber,
      title: prev.title,
      body: bodyRaw.trim(),
    });
  }

  return steps;
}
