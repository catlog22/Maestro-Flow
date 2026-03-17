import { useArtifacts } from '@/client/hooks/useArtifacts.js';
import { TreeBrowser } from '@/client/components/artifacts/TreeBrowser.js';
import { ContentRenderer } from '@/client/components/artifacts/ContentRenderer.js';
import { useI18n } from '@/client/i18n/index.js';

// ---------------------------------------------------------------------------
// ArtifactViewer -- split-pane layout: tree (left) + content (right)
// ---------------------------------------------------------------------------

export function ArtifactViewer() {
  const { t } = useI18n();
  const { tree, selectedPath, content, loading, treeLoading, error, selectFile } =
    useArtifacts();

  return (
    <div className="flex flex-col h-full" role="region" aria-label={t('artifacts.aria_viewer')}>
      {/* Breadcrumb bar */}
      <Breadcrumbs path={selectedPath} onNavigate={selectFile} />

      {/* Split pane */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Tree browser */}
        <div className="w-[var(--size-tree-panel-width)] shrink-0 border-r border-border overflow-hidden flex flex-col">
          <TreeBrowser
            tree={tree}
            selectedPath={selectedPath}
            onSelectFile={selectFile}
            loading={treeLoading}
          />
        </div>

        {/* Divider */}
        <div className="w-0 border-r border-border" role="separator" />

        {/* Right: Content renderer */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="px-[var(--spacing-3)] py-[var(--spacing-2)] border-b text-[length:var(--font-size-xs)] rounded-[var(--radius-default)] mx-[var(--spacing-3)] mt-[var(--spacing-2)]"
              style={{
                backgroundColor: 'var(--color-status-bg-blocked)',
                color: 'var(--color-status-blocked)',
                borderColor: 'var(--color-status-blocked)',
              }}
            >
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center flex-1">
              <p className="text-text-secondary text-[length:var(--font-size-sm)] animate-pulse">{t('artifacts.loading')}</p>
            </div>
          ) : content !== null && selectedPath ? (
            <ContentRenderer content={content} path={selectedPath} />
          ) : (
            <EmptyState />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Breadcrumbs -- Notion-style path segments with click navigation
// ---------------------------------------------------------------------------

function Breadcrumbs({
  path,
  onNavigate,
}: {
  path: string | null;
  onNavigate: (path: string) => void;
}) {
  const { t } = useI18n();
  const breadcrumbRoot = t('artifacts.breadcrumb_root');
  const breadcrumbLabel = t('artifacts.aria_breadcrumb');

  if (!path) {
    return (
      <nav
        aria-label={breadcrumbLabel}
        className="px-[var(--spacing-3)] py-[var(--spacing-2)] border-b border-border bg-bg-secondary text-[length:var(--font-size-sm)] text-text-secondary shrink-0"
      >
        {breadcrumbRoot}
      </nav>
    );
  }

  const segments = path.split('/');

  return (
    <nav
      aria-label={breadcrumbLabel}
      className="px-[var(--spacing-3)] py-[var(--spacing-2)] border-b border-border bg-bg-secondary text-[length:var(--font-size-sm)] shrink-0"
    >
      <ol className="flex items-center gap-[var(--spacing-1)] overflow-x-auto">
        <li className="text-text-secondary">{breadcrumbRoot}</li>
        {segments.map((seg, i) => {
          const isLast = i === segments.length - 1;
          const segPath = segments.slice(0, i + 1).join('/');
          return (
            <li key={segPath} className="flex items-center gap-[var(--spacing-1)]">
              <span className="text-text-tertiary" aria-hidden="true">/</span>
              {isLast ? (
                <span
                  className="text-text-primary font-[var(--font-weight-medium)]"
                  aria-current="page"
                >
                  {seg}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onNavigate(segPath)}
                  className="text-text-secondary hover:text-accent-blue hover:underline transition-colors duration-[var(--duration-fast)] ease-[var(--ease-notion)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)] rounded-[var(--radius-sm)]"
                >
                  {seg}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// EmptyState -- shown when no file is selected
// ---------------------------------------------------------------------------

function EmptyState() {
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center justify-center flex-1 text-text-secondary">
      <p className="text-[length:var(--font-size-lg)] mb-[var(--spacing-2)]">{t('artifacts.empty_title')}</p>
      <p className="text-[length:var(--font-size-sm)]">{t('artifacts.empty_desc')}</p>
    </div>
  );
}
