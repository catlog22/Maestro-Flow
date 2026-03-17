// ---------------------------------------------------------------------------
// categoryIcons — Emoji icons for documentation categories
// ---------------------------------------------------------------------------

/**
 * Get emoji icon for category by ID
 */
export function getCategoryIcon(categoryId: string): string {
  const icons: Record<string, string> = {
    pipeline: '⚡',
    spec: '📋',
    quality: '✅',
    manage: '⚙️',
    maestro: '🤖',
    team: '👥',
    cli: '💻',
    brainstorm: '💡',
    workflow: '🔄',
    ddd: '📚',
    issue: '🐛',
    paper: '📝',
    scholar: '🎓',
    context: '💾',
    data: '📊',
    experiment: '🧪',
    ui_design: '🎨',
    session: '🪪',
  };
  return icons[categoryId] || '📁';
}
