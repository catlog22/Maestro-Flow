import { useState, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useRequirementStore } from '@/client/store/requirement-store.js';
import type { ExpansionDepth, ChecklistItem } from '@/shared/requirement-types.js';

// ---------------------------------------------------------------------------
// RequirementPage — Design A: Focus Mode (4:6 two-column)
//   Left 40%:  input + options + buttons + history
//   Right 60%: plan checklist with cards
// ---------------------------------------------------------------------------

type ExpansionMethod = 'sdk' | 'cli';

// ---------------------------------------------------------------------------
// Left Column — Input Panel
// ---------------------------------------------------------------------------

function InputPanel() {
  const [text, setText] = useState('');
  const [depth, setDepth] = useState<ExpansionDepth>('standard');
  const [method, setMethod] = useState<ExpansionMethod>('sdk');
  const { expand, isLoading } = useRequirementStore(
    useShallow((s) => ({ expand: s.expand, isLoading: s.isLoading })),
  );

  const handleExpand = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    expand(trimmed, depth, method);
  }, [text, depth, method, expand]);

  const handlePlan = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    expand(trimmed, depth, method);
  }, [text, depth, method, expand]);

  const depthOptions: { value: ExpansionDepth; label: string }[] = [
    { value: 'high-level', label: 'High-level' },
    { value: 'standard', label: 'Standard' },
    { value: 'atomic', label: 'Atomic' },
  ];

  return (
    <div className="flex flex-col gap-[var(--spacing-4)]">
      <h2 className="text-[length:var(--font-size-md)] font-semibold text-text-primary">
        New Requirement
      </h2>

      {/* Textarea */}
      <textarea
        className="w-full h-40 px-[var(--spacing-4)] py-[var(--spacing-3)] rounded-[var(--radius-md)] border border-border bg-bg-card text-text-primary text-[length:var(--font-size-sm)] resize-y placeholder:text-text-placeholder focus:outline-none focus:shadow-[var(--shadow-focus-ring)] transition-shadow duration-[var(--duration-normal)]"
        placeholder="Describe your requirement in detail..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      {/* Depth selector */}
      <div className="flex items-center gap-[var(--spacing-3)]">
        <span className="text-[length:var(--font-size-xs)] text-text-tertiary font-medium uppercase tracking-wider w-14 shrink-0">
          Depth
        </span>
        <div className="flex gap-[var(--spacing-1)] flex-1">
          {depthOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`flex-1 px-[var(--spacing-3)] py-[var(--spacing-1-5)] rounded-[var(--radius-default)] text-[length:var(--font-size-xs)] font-medium transition-all duration-[var(--duration-fast)] ${
                depth === opt.value
                  ? 'bg-[var(--color-accent-blue)] text-white shadow-[var(--shadow-sm)]'
                  : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
              }`}
              onClick={() => setDepth(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Method selector */}
      <div className="flex items-center gap-[var(--spacing-3)]">
        <span className="text-[length:var(--font-size-xs)] text-text-tertiary font-medium uppercase tracking-wider w-14 shrink-0">
          Method
        </span>
        <div className="flex gap-[var(--spacing-1)] flex-1">
          {(['sdk', 'cli'] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={`flex-1 px-[var(--spacing-3)] py-[var(--spacing-1-5)] rounded-[var(--radius-default)] text-[length:var(--font-size-xs)] font-medium transition-all duration-[var(--duration-fast)] ${
                method === m
                  ? 'bg-[var(--color-accent-blue)] text-white shadow-[var(--shadow-sm)]'
                  : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
              }`}
              onClick={() => setMethod(m)}
            >
              {m === 'sdk' ? 'Claude SDK' : 'Claude CLI'}
            </button>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-[var(--spacing-2)] justify-end">
        <button
          type="button"
          className="px-[var(--spacing-5)] py-[var(--spacing-2)] rounded-[var(--radius-default)] border border-border text-text-secondary text-[length:var(--font-size-sm)] font-medium hover:bg-bg-secondary hover:text-text-primary transition-all duration-[var(--duration-normal)] disabled:opacity-[var(--opacity-disabled)]"
          disabled={!text.trim() || isLoading}
          onClick={handleExpand}
        >
          {isLoading ? 'Expanding...' : 'Expand'}
        </button>
        <button
          type="button"
          className="px-[var(--spacing-5)] py-[var(--spacing-2)] rounded-[var(--radius-default)] bg-[var(--color-accent-blue)] text-white text-[length:var(--font-size-sm)] font-medium shadow-[var(--shadow-sm)] hover:opacity-90 transition-all duration-[var(--duration-normal)] disabled:opacity-[var(--opacity-disabled)]"
          disabled={!text.trim() || isLoading}
          onClick={handlePlan}
        >
          Plan
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// History List
// ---------------------------------------------------------------------------

function HistoryList() {
  const { history, currentRequirement, loadHistory } = useRequirementStore(
    useShallow((s) => ({
      history: s.history,
      currentRequirement: s.currentRequirement,
      loadHistory: s.loadHistory,
    })),
  );

  if (history.length === 0) return null;

  const statusDot: Record<string, string> = {
    done: 'bg-[var(--color-accent-green)]',
    failed: 'bg-[var(--color-accent-red)]',
    reviewing: 'bg-[var(--color-accent-yellow)]',
    expanding: 'bg-[var(--color-accent-blue)]',
    committing: 'bg-[var(--color-accent-orange)]',
  };

  return (
    <div className="flex flex-col gap-[var(--spacing-2)] mt-[var(--spacing-5)] pt-[var(--spacing-5)] border-t border-divider">
      <h3 className="text-[length:var(--font-size-xs)] font-medium text-text-tertiary uppercase tracking-wider px-[var(--spacing-1)]">
        History
      </h3>
      <div className="flex flex-col gap-[var(--spacing-1)] overflow-y-auto max-h-[280px]">
        {history.map((item) => {
          const isActive = currentRequirement?.id === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`text-left px-[var(--spacing-3)] py-[var(--spacing-2)] rounded-[var(--radius-md)] transition-all duration-[var(--duration-normal)] ${
                isActive
                  ? 'bg-[var(--color-tint-exploring)] shadow-[inset_0_0_0_1px_var(--color-accent-blue)]'
                  : 'hover:bg-bg-secondary'
              }`}
              onClick={() => loadHistory(item.id)}
            >
              <div className="flex items-center gap-[var(--spacing-2)]">
                <span
                  className={`inline-block w-[6px] h-[6px] rounded-full shrink-0 ${statusDot[item.status] ?? 'bg-text-tertiary'}`}
                />
                <span className={`text-[length:var(--font-size-xs)] font-medium truncate ${isActive ? 'text-[var(--color-accent-blue)]' : 'text-text-primary'}`}>
                  {item.title || item.userInput.substring(0, 50)}
                </span>
                <span className="text-[length:var(--font-size-xs)] text-text-tertiary ml-auto shrink-0">
                  {item.items.length}
                </span>
              </div>
              <div className="flex items-center gap-[var(--spacing-2)] mt-[var(--spacing-0-5)] pl-[14px]">
                <span className="text-[length:10px] text-text-tertiary">{item.status}</span>
                <span className="text-[length:10px] text-text-placeholder">{item.depth}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Right Column — Plan Panel
// ---------------------------------------------------------------------------

function PlanPanel() {
  const { currentRequirement, isLoading, error, progressMessage } = useRequirementStore(
    useShallow((s) => ({
      currentRequirement: s.currentRequirement,
      isLoading: s.isLoading,
      error: s.error,
      progressMessage: s.progressMessage,
    })),
  );

  const status = currentRequirement?.status;

  // Empty state
  if (!currentRequirement) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-[var(--spacing-4)]">
        <div className="w-16 h-16 rounded-[var(--radius-lg)] bg-bg-secondary flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-placeholder)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" />
            <path d="M9 14l2 2 4-4" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-[length:var(--font-size-sm)] font-medium text-text-secondary">
            No plan yet
          </p>
          <p className="text-[length:var(--font-size-xs)] text-text-tertiary mt-[var(--spacing-1)]">
            Enter a requirement and click Plan to generate a structured checklist
          </p>
        </div>
      </div>
    );
  }

  // Expanding state
  if (status === 'expanding') {
    return (
      <div className="flex flex-col items-center justify-center gap-[var(--spacing-5)] h-full">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-2 border-bg-tertiary" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--color-accent-blue)] animate-spin" />
        </div>
        <div className="text-center">
          <p className="text-[length:var(--font-size-sm)] font-medium text-text-primary">
            Expanding requirement
          </p>
          <p className="text-[length:var(--font-size-xs)] text-text-tertiary mt-[var(--spacing-1)]">
            {progressMessage || 'Analyzing and structuring...'}
          </p>
        </div>
      </div>
    );
  }

  // Failed state
  if (status === 'failed') {
    return (
      <div className="flex flex-col items-center justify-center gap-[var(--spacing-4)] h-full">
        <div className="w-12 h-12 rounded-full bg-[var(--color-accent-red)]/10 flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-red)" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </div>
        <div className="text-center max-w-sm">
          <p className="text-[length:var(--font-size-sm)] font-medium text-text-primary">
            Expansion Failed
          </p>
          {(error ?? currentRequirement.error) && (
            <p className="text-[length:var(--font-size-xs)] text-[var(--color-accent-red)] mt-[var(--spacing-2)] leading-relaxed">
              {error ?? currentRequirement.error}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Committing state
  if (status === 'committing') {
    return (
      <div className="flex flex-col items-center justify-center gap-[var(--spacing-5)] h-full">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-2 border-bg-tertiary" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--color-accent-orange)] animate-spin" />
        </div>
        <div className="text-center">
          <p className="text-[length:var(--font-size-sm)] font-medium text-text-primary">
            Committing
          </p>
          <p className="text-[length:var(--font-size-xs)] text-text-tertiary mt-[var(--spacing-1)]">
            {progressMessage || 'Creating issues...'}
          </p>
        </div>
      </div>
    );
  }

  // reviewing or done
  return <ChecklistView />;
}

// ---------------------------------------------------------------------------
// ChecklistView — editable checklist with refine + commit
// ---------------------------------------------------------------------------

function ChecklistView() {
  const [feedback, setFeedback] = useState('');
  const { currentRequirement, refine, commit, updateItem, isLoading, committedResult, resetRequirement } = useRequirementStore(
    useShallow((s) => ({
      currentRequirement: s.currentRequirement,
      refine: s.refine,
      commit: s.commit,
      updateItem: s.updateItem,
      isLoading: s.isLoading,
      committedResult: s.committedResult,
      resetRequirement: s.resetRequirement,
    })),
  );

  const handleRefine = useCallback(() => {
    const trimmed = feedback.trim();
    if (!trimmed) return;
    refine(trimmed);
    setFeedback('');
  }, [feedback, refine]);

  if (!currentRequirement) return null;
  const isDone = currentRequirement.status === 'done';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 pb-[var(--spacing-4)] border-b border-divider">
        <div className="flex items-start justify-between gap-[var(--spacing-3)]">
          <div className="min-w-0">
            <h2 className="text-[length:var(--font-size-md)] font-semibold text-text-primary truncate">
              {currentRequirement.title || 'Expanded Requirement'}
            </h2>
            {currentRequirement.summary && (
              <p className="mt-[var(--spacing-1)] text-[length:var(--font-size-xs)] text-text-secondary leading-relaxed line-clamp-2">
                {currentRequirement.summary}
              </p>
            )}
          </div>
          <span className="shrink-0 px-[var(--spacing-2)] py-[var(--spacing-0-5)] rounded-full text-[length:10px] font-medium bg-bg-secondary text-text-tertiary">
            {currentRequirement.items.length} items
          </span>
        </div>

        {/* Done banner */}
        {isDone && committedResult && (
          <div className="flex items-center gap-[var(--spacing-2)] mt-[var(--spacing-3)] px-[var(--spacing-3)] py-[var(--spacing-2)] rounded-[var(--radius-md)] bg-[var(--color-tint-completed)] border border-[var(--color-accent-green)]/20">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className="text-[length:var(--font-size-xs)] text-[var(--color-accent-green)] font-medium">
              Committed as {committedResult.mode}
              {committedResult.issueIds && ` (${committedResult.issueIds.length} issues)`}
            </span>
            <button
              type="button"
              className="ml-auto text-[length:var(--font-size-xs)] text-text-tertiary hover:text-text-primary transition-colors duration-[var(--duration-fast)]"
              onClick={resetRequirement}
            >
              New
            </button>
          </div>
        )}
      </div>

      {/* Checklist items — scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto py-[var(--spacing-3)]">
        <div className="flex flex-col gap-[var(--spacing-2)]">
          {currentRequirement.items.map((item, index) => (
            <ChecklistItemCard
              key={item.id}
              item={item}
              index={index}
              disabled={isDone}
              onUpdate={(updates) => updateItem(item.id, updates)}
            />
          ))}
        </div>
      </div>

      {/* Refine + Commit — pinned bottom */}
      {!isDone && (
        <div className="shrink-0 pt-[var(--spacing-3)] border-t border-divider flex flex-col gap-[var(--spacing-3)]">
          {/* Refine row */}
          <div className="flex gap-[var(--spacing-2)]">
            <input
              className="flex-1 px-[var(--spacing-3)] py-[var(--spacing-2)] rounded-[var(--radius-default)] border border-border bg-bg-card text-text-primary text-[length:var(--font-size-xs)] placeholder:text-text-placeholder focus:outline-none focus:shadow-[var(--shadow-focus-ring)] transition-shadow duration-[var(--duration-normal)]"
              placeholder="Refinement feedback..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
            />
            <button
              type="button"
              className="px-[var(--spacing-4)] py-[var(--spacing-2)] rounded-[var(--radius-default)] border border-border text-text-secondary text-[length:var(--font-size-xs)] font-medium hover:bg-bg-secondary hover:text-text-primary transition-all duration-[var(--duration-normal)] disabled:opacity-[var(--opacity-disabled)]"
              disabled={!feedback.trim() || isLoading}
              onClick={handleRefine}
            >
              Refine
            </button>
          </div>

          {/* Commit row */}
          <div className="flex gap-[var(--spacing-2)]">
            <button
              type="button"
              className="flex-1 px-[var(--spacing-3)] py-[var(--spacing-2)] rounded-[var(--radius-default)] bg-[var(--color-accent-blue)] text-white text-[length:var(--font-size-xs)] font-medium shadow-[var(--shadow-sm)] hover:opacity-90 transition-all duration-[var(--duration-normal)] disabled:opacity-[var(--opacity-disabled)]"
              disabled={isLoading}
              onClick={() => commit('issues')}
            >
              Execute as Issues
            </button>
            <button
              type="button"
              className="flex-1 px-[var(--spacing-3)] py-[var(--spacing-2)] rounded-[var(--radius-default)] border border-[var(--color-accent-blue)] text-[var(--color-accent-blue)] text-[length:var(--font-size-xs)] font-medium hover:bg-[var(--color-tint-exploring)] transition-all duration-[var(--duration-normal)] disabled:opacity-[var(--opacity-disabled)]"
              disabled={isLoading}
              onClick={() => commit('coordinate')}
            >
              Execute as Coordinate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChecklistItemCard — single editable item with priority color bar
// ---------------------------------------------------------------------------

const PRIORITY_CONFIG: Record<string, { color: string; bg: string }> = {
  urgent: { color: 'var(--color-accent-red)', bg: 'var(--color-tint-blocked)' },
  high: { color: 'var(--color-accent-orange)', bg: 'var(--color-tint-verifying)' },
  medium: { color: 'var(--color-accent-yellow)', bg: 'var(--color-tint-executing)' },
  low: { color: 'var(--color-accent-green)', bg: 'var(--color-tint-completed)' },
};

function ChecklistItemCard({
  item,
  index,
  disabled,
  onUpdate,
}: {
  item: ChecklistItem;
  index: number;
  disabled?: boolean;
  onUpdate: (updates: Partial<ChecklistItem>) => void;
}) {
  const cfg = PRIORITY_CONFIG[item.priority] ?? PRIORITY_CONFIG.medium;

  return (
    <div
      className="group relative flex rounded-[10px] bg-bg-card border border-border shadow-[var(--shadow-sm)] overflow-hidden transition-all duration-[var(--duration-normal)] hover:-translate-y-[1px] hover:shadow-[var(--shadow-md)]"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Priority color bar */}
      <div className="w-[3px] shrink-0" style={{ backgroundColor: cfg.color }} />

      {/* Content */}
      <div className="flex-1 min-w-0 px-[var(--spacing-3)] py-[var(--spacing-3)] flex flex-col gap-[var(--spacing-1-5)]">
        {/* Title row */}
        <div className="flex items-center gap-[var(--spacing-2)]">
          <input
            className="flex-1 min-w-0 bg-transparent text-text-primary text-[length:var(--font-size-xs)] font-medium border-none outline-none focus:ring-0 p-0"
            value={item.title}
            readOnly={disabled}
            onChange={(e) => onUpdate({ title: e.target.value })}
          />
          <span
            className="shrink-0 px-[var(--spacing-1-5)] py-[1px] rounded-[var(--radius-sm)] text-[length:10px] font-medium"
            style={{ backgroundColor: cfg.bg, color: cfg.color }}
          >
            {item.type}
          </span>
        </div>

        {/* Description */}
        <textarea
          className="w-full bg-transparent text-text-secondary text-[length:11px] border-none outline-none resize-none focus:ring-0 p-0 leading-relaxed"
          rows={2}
          value={item.description}
          readOnly={disabled}
          onChange={(e) => onUpdate({ description: e.target.value })}
        />

        {/* Footer row */}
        <div className="flex items-center gap-[var(--spacing-2)]">
          <select
            className="bg-bg-secondary text-text-secondary text-[length:10px] rounded-[var(--radius-sm)] px-[var(--spacing-1-5)] py-[1px] border border-border focus:outline-none appearance-none cursor-pointer"
            value={item.priority}
            disabled={disabled}
            onChange={(e) => onUpdate({ priority: e.target.value as ChecklistItem['priority'] })}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
          <span
            className="px-[var(--spacing-1-5)] py-[1px] rounded-full text-[length:10px] font-medium"
            style={{ backgroundColor: cfg.bg, color: cfg.color }}
          >
            {item.priority}
          </span>
          {item.estimated_effort && (
            <span className="text-[length:10px] text-text-placeholder ml-auto">
              {item.estimated_effort}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page — two-column 4:6 layout
// ---------------------------------------------------------------------------

export function RequirementPage() {
  return (
    <div className="h-full flex">
      {/* Left column — input + history (40%) */}
      <div className="w-[40%] shrink-0 border-r border-divider px-[var(--spacing-6)] py-[var(--spacing-5)] flex flex-col overflow-y-auto bg-bg-primary">
        <InputPanel />
        <HistoryList />
      </div>

      {/* Right column — plan (60%) */}
      <div className="w-[60%] px-[var(--spacing-6)] py-[var(--spacing-5)] overflow-hidden bg-bg-primary">
        <PlanPanel />
      </div>
    </div>
  );
}
