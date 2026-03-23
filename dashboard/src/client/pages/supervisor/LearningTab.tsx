import { useState } from 'react';
import { useSupervisorStore } from '@/client/store/supervisor-store.js';

// ---------------------------------------------------------------------------
// LearningTab -- command patterns, knowledge base, suggestions
// ---------------------------------------------------------------------------

export function LearningTab() {
  const learningStats = useSupervisorStore((s) => s.learningStats);
  const learningPatterns = useSupervisorStore((s) => s.learningPatterns);
  const knowledgeEntries = useSupervisorStore((s) => s.knowledgeEntries);
  const [searchQuery, setSearchQuery] = useState('');

  const maxFrequency = learningPatterns.reduce((max, p) => Math.max(max, p.frequency), 1);

  const filteredEntries = searchQuery
    ? knowledgeEntries.filter(
        (e) =>
          e.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())),
      )
    : knowledgeEntries;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left column -- patterns + suggestions */}
      <div
        className="w-[360px] shrink-0 flex flex-col gap-[var(--spacing-4)] p-[var(--spacing-4)] overflow-y-auto"
        style={{ borderRight: '1px solid var(--color-border)' }}
      >
        {/* Stats overview */}
        {learningStats && (
          <div className="flex items-center gap-[var(--spacing-4)] text-[length:var(--font-size-xs)]" style={{ color: 'var(--color-text-secondary)' }}>
            <span>Commands: <span style={{ color: 'var(--color-text-primary)' }}>{learningStats.totalCommands}</span></span>
            <span>Patterns: <span style={{ color: 'var(--color-text-primary)' }}>{learningStats.uniquePatterns}</span></span>
            <span>KB Size: <span style={{ color: 'var(--color-text-primary)' }}>{learningStats.knowledgeBaseSize}</span></span>
          </div>
        )}

        {/* Command patterns */}
        <div>
          <div className="text-[length:var(--font-size-sm)] font-[var(--font-weight-medium)] mb-[var(--spacing-2)]" style={{ color: 'var(--color-text-primary)' }}>
            Command Patterns
          </div>
          {learningPatterns.length === 0 ? (
            <div className="text-[length:var(--font-size-xs)] py-[var(--spacing-3)] text-center" style={{ color: 'var(--color-text-tertiary)' }}>
              No patterns recorded
            </div>
          ) : (
            <div className="flex flex-col gap-[var(--spacing-2)]">
              {learningPatterns.map((pattern) => (
                <div
                  key={pattern.command}
                  className="px-[var(--spacing-3)] py-[var(--spacing-2)] rounded-[var(--radius-sm)]"
                  style={{ background: 'var(--color-bg-secondary)' }}
                >
                  <div className="flex items-center justify-between mb-[var(--spacing-1)]">
                    <span className="text-[length:var(--font-size-xs)] font-[var(--font-weight-medium)]" style={{ color: 'var(--color-text-primary)' }}>
                      {pattern.command}
                    </span>
                    <span className="text-[length:var(--font-size-xs)]" style={{ color: 'var(--color-text-tertiary)' }}>
                      x{pattern.frequency}
                    </span>
                  </div>
                  {/* Frequency bar */}
                  <div className="w-full h-1 rounded-full mb-[var(--spacing-1)]" style={{ background: 'var(--color-bg-tertiary)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(pattern.frequency / maxFrequency) * 100}%`,
                        background: 'var(--color-accent-blue)',
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-[var(--spacing-3)] text-[length:var(--font-size-xs)]" style={{ color: 'var(--color-text-tertiary)' }}>
                    <span>Success: {Math.round(pattern.successRate * 100)}%</span>
                    <span>Avg: {Math.round(pattern.avgDuration / 1000)}s</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Suggestions */}
        {learningStats && learningStats.suggestions.length > 0 && (
          <div>
            <div className="text-[length:var(--font-size-sm)] font-[var(--font-weight-medium)] mb-[var(--spacing-2)]" style={{ color: 'var(--color-text-primary)' }}>
              Suggestions
            </div>
            <div className="flex flex-col gap-[var(--spacing-2)]">
              {learningStats.suggestions.map((suggestion, i) => (
                <div
                  key={i}
                  className="px-[var(--spacing-3)] py-[var(--spacing-2)] rounded-[var(--radius-sm)]"
                  style={{ background: 'var(--color-bg-secondary)' }}
                >
                  <div className="flex items-center gap-[var(--spacing-2)] mb-[var(--spacing-1)]">
                    <SuggestionBadge type={suggestion.type} />
                    <span className="text-[length:var(--font-size-xs)] font-[var(--font-weight-medium)]" style={{ color: 'var(--color-text-primary)' }}>
                      {suggestion.title}
                    </span>
                  </div>
                  <div className="text-[length:var(--font-size-xs)]" style={{ color: 'var(--color-text-secondary)' }}>
                    {suggestion.description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right column -- knowledge base */}
      <div className="flex-1 flex flex-col p-[var(--spacing-4)] overflow-hidden">
        <div className="flex items-center gap-[var(--spacing-3)] mb-[var(--spacing-3)]">
          <div className="text-[length:var(--font-size-sm)] font-[var(--font-weight-medium)]" style={{ color: 'var(--color-text-primary)' }}>
            Knowledge Base
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="flex-1 px-[var(--spacing-2)] py-[var(--spacing-1)] rounded-[var(--radius-sm)] text-[length:var(--font-size-xs)] outline-none"
            style={{
              background: 'var(--color-bg-secondary)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
            }}
          />
        </div>
        {filteredEntries.length === 0 ? (
          <div className="text-[length:var(--font-size-xs)] py-[var(--spacing-3)] text-center" style={{ color: 'var(--color-text-tertiary)' }}>
            {searchQuery ? 'No matching entries' : 'Knowledge base is empty'}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto flex flex-col gap-[var(--spacing-2)]">
            {filteredEntries.map((entry) => (
              <div
                key={entry.id}
                className="px-[var(--spacing-3)] py-[var(--spacing-2)] rounded-[var(--radius-sm)]"
                style={{ background: 'var(--color-bg-secondary)' }}
              >
                <div className="flex items-center justify-between mb-[var(--spacing-1)]">
                  <span className="text-[length:var(--font-size-xs)] font-[var(--font-weight-medium)]" style={{ color: 'var(--color-text-primary)' }}>
                    {entry.topic}
                  </span>
                  <span className="text-[length:var(--font-size-xs)]" style={{ color: 'var(--color-text-tertiary)' }}>
                    {entry.source}
                  </span>
                </div>
                <div className="text-[length:var(--font-size-xs)] mb-[var(--spacing-1)]" style={{ color: 'var(--color-text-secondary)' }}>
                  {entry.content.length > 200 ? `${entry.content.slice(0, 200)}...` : entry.content}
                </div>
                {entry.tags.length > 0 && (
                  <div className="flex flex-wrap gap-[var(--spacing-1)]">
                    {entry.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[length:var(--font-size-xs)] px-[var(--spacing-1)] rounded"
                        style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SuggestionBadge
// ---------------------------------------------------------------------------

const SUGGESTION_COLORS: Record<string, string> = {
  optimize: 'var(--color-accent-blue)',
  alert: 'var(--color-accent-red)',
  automate: 'var(--color-accent-green)',
};

function SuggestionBadge({ type }: { type: string }) {
  return (
    <span
      className="text-[length:var(--font-size-xs)] px-[var(--spacing-1)] rounded"
      style={{ background: SUGGESTION_COLORS[type] ?? 'var(--color-bg-tertiary)', color: '#fff' }}
    >
      {type}
    </span>
  );
}
