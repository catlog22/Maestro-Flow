import { useState, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useRequirementStore } from '@/client/store/requirement-store.js';
import type { ExpansionDepth, ChecklistItem } from '@/shared/requirement-types.js';

// ---------------------------------------------------------------------------
// RequirementPage -- 6-state flow: draft > expanding > reviewing > committing > done > failed
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Sub-views
// ---------------------------------------------------------------------------

function DraftView() {
  const [text, setText] = useState('');
  const [depth, setDepth] = useState<ExpansionDepth>('standard');
  const expand = useRequirementStore((s) => s.expand);

  const handleExpand = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    expand(trimmed, depth);
  }, [text, depth, expand]);

  const depthOptions: { value: ExpansionDepth; label: string; hint: string }[] = [
    { value: 'high-level', label: 'High-level', hint: 'Broad strokes, fewer items' },
    { value: 'standard', label: 'Standard', hint: 'Balanced decomposition' },
    { value: 'atomic', label: 'Atomic', hint: 'Fine-grained, many items' },
  ];

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto">
      <h2 className="text-[length:var(--font-size-lg)] font-semibold text-text-primary">
        New Requirement
      </h2>
      <textarea
        className="w-full h-40 p-3 rounded-md border border-border bg-bg-secondary text-text-primary text-[length:var(--font-size-sm)] resize-y focus:outline-none focus:ring-1 focus:ring-accent-primary"
        placeholder="Describe your requirement..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <div className="flex flex-col gap-2">
        <label className="text-[length:var(--font-size-xs)] font-medium text-text-secondary">
          Expansion Depth
        </label>
        <div className="flex gap-2">
          {depthOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`flex-1 px-3 py-2 rounded-md border text-[length:var(--font-size-xs)] transition-colors ${
                depth === opt.value
                  ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                  : 'border-border bg-bg-secondary text-text-secondary hover:border-text-tertiary'
              }`}
              onClick={() => setDepth(opt.value)}
            >
              <div className="font-medium">{opt.label}</div>
              <div className="text-text-tertiary mt-0.5">{opt.hint}</div>
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        className="self-end px-4 py-2 rounded-md bg-accent-primary text-white text-[length:var(--font-size-sm)] font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
        disabled={!text.trim()}
        onClick={handleExpand}
      >
        Expand
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ExpandingView({ message }: { message: string | null }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 max-w-md mx-auto py-16">
      <div className="w-full h-2 rounded-full bg-bg-tertiary overflow-hidden">
        <div className="h-full bg-accent-primary rounded-full animate-pulse" style={{ width: '60%' }} />
      </div>
      <p className="text-[length:var(--font-size-sm)] text-text-secondary">
        {message || 'Expanding requirement...'}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ChecklistItemCard({
  item,
  onUpdate,
}: {
  item: ChecklistItem;
  onUpdate: (updates: Partial<ChecklistItem>) => void;
}) {
  const priorityColors: Record<string, string> = {
    low: 'bg-green-500/15 text-green-400',
    medium: 'bg-yellow-500/15 text-yellow-400',
    high: 'bg-orange-500/15 text-orange-400',
    urgent: 'bg-red-500/15 text-red-400',
  };

  return (
    <div className="p-3 rounded-md border border-border bg-bg-secondary flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <input
          className="flex-1 bg-transparent text-text-primary text-[length:var(--font-size-sm)] font-medium border-none outline-none focus:ring-0"
          value={item.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
        />
        <span className="shrink-0 text-[length:var(--font-size-xs)] text-text-tertiary">
          {item.type}
        </span>
      </div>
      <textarea
        className="w-full bg-transparent text-text-secondary text-[length:var(--font-size-xs)] border-none outline-none resize-none focus:ring-0"
        rows={2}
        value={item.description}
        onChange={(e) => onUpdate({ description: e.target.value })}
      />
      <div className="flex items-center gap-2">
        <select
          className="bg-bg-tertiary text-text-secondary text-[length:var(--font-size-xs)] rounded px-2 py-1 border border-border focus:outline-none"
          value={item.priority}
          onChange={(e) => onUpdate({ priority: e.target.value as ChecklistItem['priority'] })}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
        <span className={`px-2 py-0.5 rounded text-[length:var(--font-size-xs)] ${priorityColors[item.priority] ?? ''}`}>
          {item.priority}
        </span>
        {item.estimated_effort && (
          <span className="text-[length:var(--font-size-xs)] text-text-tertiary ml-auto">
            {item.estimated_effort}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ReviewingView() {
  const [feedback, setFeedback] = useState('');
  const { currentRequirement, refine, commit, updateItem } = useRequirementStore(
    useShallow((s) => ({
      currentRequirement: s.currentRequirement,
      refine: s.refine,
      commit: s.commit,
      updateItem: s.updateItem,
    })),
  );

  if (!currentRequirement) return null;

  const handleRefine = useCallback(() => {
    const trimmed = feedback.trim();
    if (!trimmed) return;
    refine(trimmed);
    setFeedback('');
  }, [feedback, refine]);

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto">
      <div>
        <h2 className="text-[length:var(--font-size-lg)] font-semibold text-text-primary">
          {currentRequirement.title || 'Expanded Requirement'}
        </h2>
        {currentRequirement.summary && (
          <p className="mt-1 text-[length:var(--font-size-sm)] text-text-secondary">
            {currentRequirement.summary}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-[length:var(--font-size-sm)] font-medium text-text-secondary">
          Checklist Items ({currentRequirement.items.length})
        </h3>
        {currentRequirement.items.map((item) => (
          <ChecklistItemCard
            key={item.id}
            item={item}
            onUpdate={(updates) => updateItem(item.id, updates)}
          />
        ))}
      </div>

      <div className="flex flex-col gap-2 pt-2 border-t border-border">
        <label className="text-[length:var(--font-size-xs)] font-medium text-text-secondary">
          Refinement Feedback
        </label>
        <textarea
          className="w-full h-20 p-3 rounded-md border border-border bg-bg-secondary text-text-primary text-[length:var(--font-size-sm)] resize-y focus:outline-none focus:ring-1 focus:ring-accent-primary"
          placeholder="Describe changes you want..."
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
        />
        <button
          type="button"
          className="self-start px-4 py-2 rounded-md border border-accent-primary text-accent-primary text-[length:var(--font-size-sm)] font-medium hover:bg-accent-primary/10 transition-colors disabled:opacity-40"
          disabled={!feedback.trim()}
          onClick={handleRefine}
        >
          Refine
        </button>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          className="flex-1 px-4 py-2 rounded-md bg-accent-primary text-white text-[length:var(--font-size-sm)] font-medium hover:opacity-90 transition-opacity"
          onClick={() => commit('issues')}
        >
          Execute as Issues
        </button>
        <button
          type="button"
          className="flex-1 px-4 py-2 rounded-md border border-accent-primary text-accent-primary text-[length:var(--font-size-sm)] font-medium hover:bg-accent-primary/10 transition-colors"
          onClick={() => commit('coordinate')}
        >
          Execute as Coordinate
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function CommittingView({ message }: { message: string | null }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 max-w-md mx-auto py-16">
      <div className="w-full h-2 rounded-full bg-bg-tertiary overflow-hidden">
        <div className="h-full bg-accent-primary rounded-full animate-pulse" style={{ width: '80%' }} />
      </div>
      <p className="text-[length:var(--font-size-sm)] text-text-secondary">
        {message || 'Committing requirement...'}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------

function DoneView({ requirementId }: { requirementId: string }) {
  const reset = useRequirementStore((s) => s.resetRequirement);

  return (
    <div className="flex flex-col items-center justify-center gap-4 max-w-md mx-auto py-16">
      <div className="w-12 h-12 rounded-full bg-green-500/15 flex items-center justify-center">
        <span className="text-green-400 text-xl">&#10003;</span>
      </div>
      <h2 className="text-[length:var(--font-size-lg)] font-semibold text-text-primary">
        Requirement Committed
      </h2>
      <p className="text-[length:var(--font-size-sm)] text-text-secondary text-center">
        Your requirement has been successfully processed.
      </p>
      <div className="flex gap-3">
        <a
          href={`/requirement/${requirementId}/board`}
          className="px-4 py-2 rounded-md bg-accent-primary text-white text-[length:var(--font-size-sm)] font-medium hover:opacity-90 transition-opacity"
        >
          View Board
        </a>
        <button
          type="button"
          className="px-4 py-2 rounded-md border border-border text-text-secondary text-[length:var(--font-size-sm)] font-medium hover:border-text-tertiary transition-colors"
          onClick={reset}
        >
          New Requirement
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function FailedView({ errorMsg }: { errorMsg: string | null }) {
  const { resetRequirement, currentRequirement, expand } = useRequirementStore(
    useShallow((s) => ({
      resetRequirement: s.resetRequirement,
      currentRequirement: s.currentRequirement,
      expand: s.expand,
    })),
  );

  const handleRetry = useCallback(() => {
    if (currentRequirement) {
      expand(currentRequirement.userInput, currentRequirement.depth);
    }
  }, [currentRequirement, expand]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 max-w-md mx-auto py-16">
      <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center">
        <span className="text-red-400 text-xl">&#10007;</span>
      </div>
      <h2 className="text-[length:var(--font-size-lg)] font-semibold text-text-primary">
        Expansion Failed
      </h2>
      {errorMsg && (
        <p className="text-[length:var(--font-size-sm)] text-red-400 text-center max-w-sm">
          {errorMsg}
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          className="px-4 py-2 rounded-md bg-accent-primary text-white text-[length:var(--font-size-sm)] font-medium hover:opacity-90 transition-opacity"
          onClick={handleRetry}
        >
          Retry
        </button>
        <button
          type="button"
          className="px-4 py-2 rounded-md border border-border text-text-secondary text-[length:var(--font-size-sm)] font-medium hover:border-text-tertiary transition-colors"
          onClick={resetRequirement}
        >
          Start Over
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export function RequirementPage() {
  const { currentRequirement, error, progressMessage } = useRequirementStore(
    useShallow((s) => ({
      currentRequirement: s.currentRequirement,
      error: s.error,
      progressMessage: s.progressMessage,
    })),
  );

  const status = currentRequirement?.status ?? 'draft';

  return (
    <div className="h-full overflow-y-auto p-6">
      {status === 'draft' && <DraftView />}
      {status === 'expanding' && <ExpandingView message={progressMessage} />}
      {status === 'reviewing' && <ReviewingView />}
      {status === 'committing' && <CommittingView message={progressMessage} />}
      {status === 'done' && <DoneView key={currentRequirement?.id} requirementId={currentRequirement?.id ?? ''} />}
      {status === 'failed' && <FailedView errorMsg={error ?? currentRequirement?.error ?? null} />}
    </div>
  );
}
