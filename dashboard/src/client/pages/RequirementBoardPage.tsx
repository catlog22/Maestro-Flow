import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useRequirementStore } from '@/client/store/requirement-store.js';
import { useIssueStore } from '@/client/store/issue-store.js';
import { useCoordinateStore } from '@/client/store/coordinate-store.js';
import type { Issue, IssueStatus } from '@/shared/issue-types.js';
import type { CoordinateStep, CoordinateStepStatus } from '@/shared/coordinate-types.js';
import { OrchestratorStatusBar } from '@/client/components/kanban/OrchestratorStatusBar.js';
import CheckCircleIcon from 'lucide-react/dist/esm/icons/check-circle.js';
import XCircleIcon from 'lucide-react/dist/esm/icons/x-circle.js';
import CircleIcon from 'lucide-react/dist/esm/icons/circle.js';
import LoaderIcon from 'lucide-react/dist/esm/icons/loader.js';
import MinusIcon from 'lucide-react/dist/esm/icons/minus.js';
import ArrowLeftIcon from 'lucide-react/dist/esm/icons/arrow-left.js';

// ---------------------------------------------------------------------------
// RequirementBoardPage -- progress tracking in Issue or Coordinate mode
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Issue mode helpers
// ---------------------------------------------------------------------------

const ISSUE_STATUS_COLORS: Record<IssueStatus, string> = {
  open: 'var(--color-text-tertiary)',
  registered: 'var(--color-accent-blue)',
  in_progress: 'var(--color-accent-blue)',
  resolved: 'var(--color-accent-green)',
  closed: 'var(--color-accent-green)',
  deferred: 'var(--color-text-tertiary)',
};

function IssueStatusIcon({ status }: { status: IssueStatus }) {
  switch (status) {
    case 'resolved':
    case 'closed':
      return <CheckCircleIcon size={14} style={{ color: ISSUE_STATUS_COLORS[status] }} />;
    case 'in_progress':
      return <LoaderIcon size={14} className="animate-spin" style={{ color: ISSUE_STATUS_COLORS[status] }} />;
    case 'open':
    case 'registered':
      return <CircleIcon size={14} style={{ color: ISSUE_STATUS_COLORS[status] }} />;
    case 'deferred':
    default:
      return <MinusIcon size={14} style={{ color: 'var(--color-text-tertiary)' }} />;
  }
}

function IssueCard({ issue }: { issue: Issue }) {
  const priorityColors: Record<string, string> = {
    low: 'bg-green-500/15 text-green-400',
    medium: 'bg-yellow-500/15 text-yellow-400',
    high: 'bg-orange-500/15 text-orange-400',
    urgent: 'bg-red-500/15 text-red-400',
  };

  return (
    <div
      className="p-[var(--spacing-3)] rounded-[var(--radius-sm)] flex flex-col gap-[var(--spacing-2)]"
      style={{
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
      }}
    >
      <div className="flex items-start gap-[var(--spacing-2)]">
        <IssueStatusIcon status={issue.status} />
        <span
          className="flex-1 text-[length:var(--font-size-sm)] font-medium"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {issue.title}
        </span>
        <span className="shrink-0 text-[length:var(--font-size-xs)] text-text-tertiary">
          {issue.type}
        </span>
      </div>
      {issue.description && (
        <p
          className="text-[length:var(--font-size-xs)] line-clamp-2"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {issue.description}
        </p>
      )}
      <div className="flex items-center gap-[var(--spacing-2)]">
        <span
          className={`px-2 py-0.5 rounded text-[length:var(--font-size-xs)] ${priorityColors[issue.priority] ?? ''}`}
        >
          {issue.priority}
        </span>
        <span
          className="text-[length:var(--font-size-xs)]"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {issue.status}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Coordinate mode helpers (reused from CoordinatePanel patterns)
// ---------------------------------------------------------------------------

function StepStatusIcon({ status }: { status: CoordinateStepStatus }) {
  switch (status) {
    case 'running':
      return <LoaderIcon size={14} className="animate-spin" style={{ color: 'var(--color-accent-blue)' }} />;
    case 'completed':
      return <CheckCircleIcon size={14} style={{ color: 'var(--color-accent-green)' }} />;
    case 'failed':
      return <XCircleIcon size={14} style={{ color: 'var(--color-accent-red)' }} />;
    case 'skipped':
      return <MinusIcon size={14} style={{ color: 'var(--color-text-tertiary)' }} />;
    case 'pending':
    default:
      return <CircleIcon size={14} style={{ color: 'var(--color-text-tertiary)' }} />;
  }
}

function CoordinateStepCard({
  step,
  isSelected,
  onSelect,
}: {
  step: CoordinateStep;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full flex items-center gap-[var(--spacing-2)] px-[var(--spacing-3)] py-[var(--spacing-2)] rounded-[var(--radius-sm)] text-left transition-colors"
      style={{
        background: isSelected ? 'var(--color-bg-tertiary)' : 'transparent',
      }}
    >
      <StepStatusIcon status={step.status} />
      <span
        className="flex-1 text-[length:var(--font-size-sm)] truncate"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {step.cmd}
        {step.args ? ` ${step.args}` : ''}
      </span>
      {step.summary && (
        <span
          className="text-[length:var(--font-size-xs)] shrink-0"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {step.summary}
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Issue mode view
// ---------------------------------------------------------------------------

function IssueModeView({ issueIds }: { issueIds: string[] }) {
  const { issues, fetchIssues, loading } = useIssueStore();

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  const filteredIssues = useMemo(
    () => issues.filter((issue) => issueIds.includes(issue.id)),
    [issues, issueIds],
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const issue of filteredIssues) {
      counts[issue.status] = (counts[issue.status] ?? 0) + 1;
    }
    return counts;
  }, [filteredIssues]);

  if (loading && filteredIssues.length === 0) {
    return (
      <div
        className="flex items-center justify-center py-[var(--spacing-8)]"
        style={{ color: 'var(--color-text-tertiary)' }}
      >
        Loading issues...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-4)] p-[var(--spacing-4)]">
      {/* Summary bar */}
      <div className="flex items-center gap-[var(--spacing-4)]">
        <span className="text-[length:var(--font-size-sm)] font-medium" style={{ color: 'var(--color-text-primary)' }}>
          {filteredIssues.length} Issues
        </span>
        {Object.entries(statusCounts).map(([status, count]) => (
          <span key={status} className="text-[length:var(--font-size-xs)]" style={{ color: 'var(--color-text-secondary)' }}>
            {status}: {count}
          </span>
        ))}
      </div>

      {/* Issue cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[var(--spacing-3)]">
        {filteredIssues.map((issue) => (
          <IssueCard key={issue.id} issue={issue} />
        ))}
      </div>

      {filteredIssues.length === 0 && (
        <div
          className="text-[length:var(--font-size-sm)] text-center py-[var(--spacing-8)]"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          No issues found for this requirement.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Coordinate mode view
// ---------------------------------------------------------------------------

function CoordinateModeView({ sessionId }: { sessionId: string }) {
  const session = useCoordinateStore((s) => s.session);
  const selectStep = useCoordinateStore((s) => s.selectStep);
  const selectedStepIndex = useCoordinateStore((s) => s.selectedStepIndex);

  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  // If coordinate store has the matching session, use its data
  const isActiveSession = session?.sessionId === sessionId;
  const steps = isActiveSession ? session.steps : [];

  const selectedStep = useMemo(
    () => (selectedIdx != null ? steps.find((s) => s.index === selectedIdx) ?? null : null),
    [steps, selectedIdx],
  );

  const handleSelectStep = useCallback(
    (index: number) => {
      setSelectedIdx((prev) => (prev === index ? null : index));
      if (isActiveSession) {
        selectStep(index);
      }
    },
    [isActiveSession, selectStep],
  );

  const progressCounts = useMemo(() => {
    const counts = { completed: 0, running: 0, failed: 0, pending: 0, skipped: 0 };
    for (const step of steps) {
      counts[step.status] = (counts[step.status] ?? 0) + 1;
    }
    return counts;
  }, [steps]);

  if (!isActiveSession) {
    return (
      <div
        className="flex items-center justify-center py-[var(--spacing-8)]"
        style={{ color: 'var(--color-text-tertiary)' }}
      >
        <span className="text-[length:var(--font-size-sm)]">
          Coordinate session not active. Session: {sessionId}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Step list sidebar */}
      <div
        className="w-[280px] shrink-0 flex flex-col overflow-y-auto"
        style={{ borderRight: '1px solid var(--color-border)' }}
      >
        {/* Progress header */}
        <div
          className="px-[var(--spacing-4)] py-[var(--spacing-3)] shrink-0"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <div
            className="text-[length:var(--font-size-sm)] font-medium"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {session.chainName ?? 'Session Steps'}
          </div>
          <div
            className="text-[length:var(--font-size-xs)] mt-[var(--spacing-1)]"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Step {session.currentStep + 1} / {steps.length || '?'}
            {' | '}
            {progressCounts.completed} done
            {progressCounts.failed > 0 && `, ${progressCounts.failed} failed`}
            {session.avgQuality != null && ` | Quality: ${session.avgQuality}`}
          </div>
        </div>

        {/* Step list */}
        <div className="flex-1 overflow-y-auto p-[var(--spacing-2)]">
          {steps.map((step) => (
            <CoordinateStepCard
              key={step.index}
              step={step}
              isSelected={selectedIdx === step.index}
              onSelect={() => handleSelectStep(step.index)}
            />
          ))}
        </div>
      </div>

      {/* Step detail panel */}
      <div className="flex-1 overflow-y-auto p-[var(--spacing-4)]">
        {selectedStep ? (
          <div className="flex flex-col gap-[var(--spacing-3)]">
            <div className="flex items-center gap-[var(--spacing-2)]">
              <StepStatusIcon status={selectedStep.status} />
              <span
                className="text-[length:var(--font-size-base)] font-medium"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {selectedStep.cmd}
              </span>
              {selectedStep.args && (
                <span
                  className="text-[length:var(--font-size-sm)]"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {selectedStep.args}
                </span>
              )}
            </div>

            {selectedStep.summary && (
              <div>
                <div
                  className="text-[length:var(--font-size-xs)] font-medium mb-[var(--spacing-1)]"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Summary
                </div>
                <div
                  className="text-[length:var(--font-size-sm)] rounded-[var(--radius-sm)] p-[var(--spacing-3)]"
                  style={{
                    color: 'var(--color-text-primary)',
                    background: 'var(--color-bg-secondary)',
                  }}
                >
                  {selectedStep.summary}
                </div>
              </div>
            )}

            {selectedStep.analysis && (
              <div>
                <div
                  className="text-[length:var(--font-size-xs)] font-medium mb-[var(--spacing-1)]"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Analysis
                </div>
                <pre
                  className="text-[length:var(--font-size-xs)] rounded-[var(--radius-sm)] p-[var(--spacing-3)] overflow-x-auto whitespace-pre-wrap"
                  style={{
                    color: 'var(--color-text-primary)',
                    background: 'var(--color-bg-secondary)',
                  }}
                >
                  {selectedStep.analysis}
                </pre>
              </div>
            )}
          </div>
        ) : (
          <div
            className="text-[length:var(--font-size-sm)] text-center py-[var(--spacing-6)]"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            Select a step to view details
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export function RequirementBoardPage() {
  const { id: requirementId } = useParams<{ id: string }>();
  const currentRequirement = useRequirementStore((s) => s.currentRequirement);
  const committedResult = useRequirementStore((s) => s.committedResult);

  // Determine mode from committed result matching this requirementId
  const isMatch = committedResult != null && committedResult.requirementId === requirementId;
  const mode = isMatch ? committedResult.mode : null;
  const issueIds = isMatch ? (committedResult.issueIds ?? []) : [];
  const coordinateSessionId = isMatch ? (committedResult.coordinateSessionId ?? '') : '';

  // Page title from current requirement if available
  const hasReq = currentRequirement != null && currentRequirement.id === requirementId;
  const title = hasReq
    ? currentRequirement.title
    : `Requirement ${requirementId ?? ''}`;
  const summary = hasReq
    ? currentRequirement.summary
    : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="shrink-0 flex items-center gap-[var(--spacing-3)] px-[var(--spacing-4)] py-[var(--spacing-3)]"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <a
          href="/requirement"
          className="flex items-center justify-center w-7 h-7 rounded-[var(--radius-sm)] transition-colors"
          style={{ color: 'var(--color-text-secondary)' }}
          title="Back to Requirements"
        >
          <ArrowLeftIcon size={16} />
        </a>
        <div className="flex-1 min-w-0">
          <h1
            className="text-[length:var(--font-size-base)] font-semibold truncate"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {title}
          </h1>
          {summary && (
            <p
              className="text-[length:var(--font-size-xs)] truncate mt-[var(--spacing-0-5)]"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {summary}
            </p>
          )}
        </div>
        {mode && (
          <span
            className="shrink-0 px-[var(--spacing-2)] py-[var(--spacing-1)] rounded-[var(--radius-sm)] text-[length:var(--font-size-xs)] font-medium"
            style={{
              background: mode === 'issues' ? 'var(--color-accent-blue)' : 'var(--color-accent-green)',
              color: '#fff',
            }}
          >
            {mode === 'issues' ? 'Issues' : 'Coordinate'}
          </span>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        {!mode && (
          <div
            className="flex items-center justify-center h-full"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            <span className="text-[length:var(--font-size-sm)]">
              No board data available for this requirement.
            </span>
          </div>
        )}
        {mode === 'issues' && <IssueModeView issueIds={issueIds} />}
        {mode === 'coordinate' && <CoordinateModeView sessionId={coordinateSessionId} />}
      </div>

      {/* Bottom status bar */}
      <OrchestratorStatusBar />
    </div>
  );
}
