import { useI18n } from '@/client/i18n/index.js';
import { MarkdownRenderer } from '@/client/components/content/MarkdownRenderer.js';
import { loadCommand, type CommandContent } from '@/client/data/index.js';
import { getCategoryIcon } from '@/client/utils/categoryIcons.js';
import type { Category, Command } from '@/client/routes/route-config.js';
import { useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// CommandDetailPage — full documentation for a single command
// ---------------------------------------------------------------------------

interface CommandDetailPageProps {
  commandName: string;
  category: Category;
  command: Command;
}

export default function CommandDetailPage({ commandName, category, command }: CommandDetailPageProps) {
  const { t } = useI18n();
  const [content, setContent] = useState<CommandContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchContent() {
      try {
        setLoading(true);
        setError(null);
        const data = await loadCommand(commandName);
        setContent(data);
        if (!data) {
          setError(`Command "${commandName}" not found`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load command');
      } finally {
        setLoading(false);
      }
    }
    fetchContent();
  }, [commandName]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-blue" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="p-4 bg-bg-error/10 border border-border-error rounded-[var(--radius-default)]">
          <p className="text-text-error">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-[var(--spacing-6)]">
        <div className="flex items-center gap-[var(--spacing-2)] mb-[var(--spacing-2)]">
          <span className="text-2xl">{getCategoryIcon(category.id)}</span>
          <div>
            <h1 className="text-[length:var(--font-size-2xl)] font-[var(--font-weight-bold)] text-text-primary">
              {content?.name || command.name}
            </h1>
            <p className="text-[length:var(--font-size-sm)] text-text-tertiary">
              {category.name}
            </p>
          </div>
        </div>
        <p className="text-[length:var(--font-size-base)] text-text-secondary">
          {content?.description || command.description}
        </p>
      </div>

      {/* Command usage */}
      {(content?.argumentHint || command.argumentHint) && (
        <section className="mb-[var(--spacing-6)]">
          <h2 className="text-[length:var(--font-size-lg)] font-[var(--font-weight-semibold)] text-text-primary mb-[var(--spacing-3)]">
            {t('content.usage')}
          </h2>
          <code className="block px-[var(--spacing-3)] py-[var(--spacing-2)] bg-bg-code text-text-code rounded-[var(--radius-default)] text-[length:var(--font-size-sm)] overflow-x-auto">
            /{command.name} {content?.argumentHint || command.argumentHint}
          </code>
        </section>
      )}

      {/* Purpose section */}
      {content?.purpose && (
        <section className="mb-[var(--spacing-6)]">
          <h2 className="text-[length:var(--font-size-lg)] font-[var(--font-weight-semibold)] text-text-primary mb-[var(--spacing-3)]">
            Purpose
          </h2>
          <div className="text-text-secondary">
            <MarkdownRenderer content={content.purpose} />
          </div>
        </section>
      )}

      {/* Required Reading */}
      {content?.requiredReading && (
        <section className="mb-[var(--spacing-6)]">
          <h2 className="text-[length:var(--font-size-lg)] font-[var(--font-weight-semibold)] text-text-primary mb-[var(--spacing-3)]">
            Required Reading
          </h2>
          <div className="text-text-secondary">
            <MarkdownRenderer content={content.requiredReading} />
          </div>
        </section>
      )}

      {/* Context */}
      {content?.context && (
        <section className="mb-[var(--spacing-6)]">
          <h2 className="text-[length:var(--font-size-lg)] font-[var(--font-weight-semibold)] text-text-primary mb-[var(--spacing-3)]">
            Context
          </h2>
          <div className="text-text-secondary">
            <MarkdownRenderer content={content.context} />
          </div>
        </section>
      )}

      {/* Execution */}
      {content?.execution && (
        <section className="mb-[var(--spacing-6)]">
          <h2 className="text-[length:var(--font-size-lg)] font-[var(--font-weight-semibold)] text-text-primary mb-[var(--spacing-3)]">
            Execution
          </h2>
          <div className="text-text-secondary">
            <MarkdownRenderer content={content.execution} />
          </div>
        </section>
      )}

      {/* Error Codes */}
      {content?.errorCodes && (
        <section className="mb-[var(--spacing-6)]">
          <h2 className="text-[length:var(--font-size-lg)] font-[var(--font-weight-semibold)] text-text-primary mb-[var(--spacing-3)]">
            Error Codes
          </h2>
          <div className="text-text-secondary">
            <MarkdownRenderer content={content.errorCodes} />
          </div>
        </section>
      )}

      {/* Success Criteria */}
      {content?.successCriteria && (
        <section className="mb-[var(--spacing-6)]">
          <h2 className="text-[length:var(--font-size-lg)] font-[var(--font-weight-semibold)] text-text-primary mb-[var(--spacing-3)]">
            Success Criteria
          </h2>
          <div className="text-text-secondary">
            <MarkdownRenderer content={content.successCriteria} />
          </div>
        </section>
      )}

      {/* Allowed tools */}
      {(content?.allowedTools && content.allowedTools.length > 0) && (
        <section className="mb-[var(--spacing-6)]">
          <h2 className="text-[length:var(--font-size-lg)] font-[var(--font-weight-semibold)] text-text-primary mb-[var(--spacing-3)]">
            {t('content.allowed_tools')}
          </h2>
          <div className="flex flex-wrap gap-[var(--spacing-2)]">
            {content.allowedTools.map((tool) => (
              <span
                key={tool}
                className="px-[var(--spacing-2)] py-[var(--spacing-1)] bg-bg-secondary border border-border rounded-[var(--radius-sm)] text-[length:var(--font-size-sm)] text-text-secondary"
              >
                {tool}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* File reference */}
      {command.file && (
        <section className="mb-[var(--spacing-6)]">
          <h2 className="text-[length:var(--font-size-lg)] font-[var(--font-weight-semibold)] text-text-primary mb-[var(--spacing-3)]">
            {t('content.file_reference')}
          </h2>
          <code className="px-[var(--spacing-2)] py-[var(--spacing-1)] bg-bg-secondary border border-border rounded-[var(--radius-sm)] text-[length:var(--font-size-sm)] text-text-secondary">
            {command.file}
          </code>
        </section>
      )}

      {/* Full documentation content (if not already shown) */}
      {content?.rawContent && !content.purpose && (
        <section className="mb-[var(--spacing-6)]">
          <h2 className="text-[length:var(--font-size-lg)] font-[var(--font-weight-semibold)] text-text-primary mb-[var(--spacing-3)]">
            Documentation
          </h2>
          <div className="text-text-secondary">
            <MarkdownRenderer content={content.rawContent} />
          </div>
        </section>
      )}
    </div>
  );
}
