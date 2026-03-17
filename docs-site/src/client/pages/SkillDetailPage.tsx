import { useI18n } from '@/client/i18n/index.js';
import { MarkdownRenderer } from '@/client/components/content/MarkdownRenderer.js';
import { loadSkill, type SkillContent } from '@/client/data/index.js';
import type { Category, Skill } from '@/client/routes/route-config.js';
import { useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// SkillDetailPage — full documentation for a Claude or Codex skill
// ---------------------------------------------------------------------------

interface SkillDetailPageProps {
  skillName: string;
  skillType: 'claude' | 'codex';
  skill: Skill;
  category: Category;
}

export default function SkillDetailPage({ skillName, skillType, skill, category }: SkillDetailPageProps) {
  const { t } = useI18n();
  const [content, setContent] = useState<SkillContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchContent() {
      try {
        setLoading(true);
        setError(null);
        const data = await loadSkill(skillType, skillName);
        setContent(data);
        if (!data) {
          setError(`Skill "${skillName}" not found in ${skillType} skills`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load skill');
      } finally {
        setLoading(false);
      }
    }
    fetchContent();
  }, [skillName, skillType]);

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
          <span className="text-2xl">
            {skillType === 'claude' ? '🤖' : '⚡'}
          </span>
          <div>
            <div className="flex items-center gap-[var(--spacing-2)]">
              <h1 className="text-[length:var(--font-size-2xl)] font-[var(--font-weight-bold)] text-text-primary">
                {content?.name || skill.name}
              </h1>
              <span
                className={[
                  'px-2 py-0.5 text-[length:var(--font-size-xs)] rounded-sm',
                  'font-[var(--font-weight-medium)] uppercase',
                  skillType === 'claude'
                    ? 'bg-accent-purple/10 text-accent-purple'
                    : 'bg-accent-orange/10 text-accent-orange',
                ].join(' ')}
              >
                {skillType === 'claude' ? 'Claude Skill' : 'Codex Skill'}
              </span>
            </div>
            <p className="text-[length:var(--font-size-sm)] text-text-tertiary">
              {category.name}
            </p>
          </div>
        </div>
        <p className="text-[length:var(--font-size-base)] text-text-secondary">
          {content?.description || skill.description}
        </p>
      </div>

      {/* Usage/Argument hint */}
      {content?.argumentHint && (
        <section className="mb-[var(--spacing-6)]">
          <h2 className="text-[length:var(--font-size-lg)] font-[var(--font-weight-semibold)] text-text-primary mb-[var(--spacing-3)]">
            {t('content.usage')}
          </h2>
          <code className="block px-[var(--spacing-3)] py-[var(--spacing-2)] bg-bg-code text-text-code rounded-[var(--radius-default)] text-[length:var(--font-size-sm)] overflow-x-auto">
            {`Skill({ skill: "${skillName}" }${content.argumentHint !== 'true' ? `, args: "${content.argumentHint}"` : ''})`}
          </code>
        </section>
      )}

      {/* Roles (from content or inventory) */}
      {(content?.roles && content.roles.length > 0) && (
        <section className="mb-[var(--spacing-6)]">
          <h2 className="text-[length:var(--font-size-lg)] font-[var(--font-weight-semibold)] text-text-primary mb-[var(--spacing-3)]">
            {t('content.roles')}
          </h2>
          <div className="flex flex-wrap gap-[var(--spacing-2)]">
            {content.roles.map((role) => (
              <span
                key={role}
                className="px-[var(--spacing-2)] py-[var(--spacing-1)] bg-bg-secondary border border-border rounded-[var(--radius-sm)] text-[length:var(--font-size-sm)] text-text-secondary"
              >
                {role}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Fallback to inventory roles if content doesn't have them */}
      {(!content?.roles && skill.roles && skill.roles.length > 0) && (
        <section className="mb-[var(--spacing-6)]">
          <h2 className="text-[length:var(--font-size-lg)] font-[var(--font-weight-semibold)] text-text-primary mb-[var(--spacing-3)]">
            {t('content.roles')}
          </h2>
          <div className="flex flex-wrap gap-[var(--spacing-2)]">
            {skill.roles.map((role) => (
              <span
                key={role}
                className="px-[var(--spacing-2)] py-[var(--spacing-1)] bg-bg-secondary border border-border rounded-[var(--radius-sm)] text-[length:var(--font-size-sm)] text-text-secondary"
              >
                {role}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Phases */}
      {(content?.phases && content.phases.length > 0) && (
        <section className="mb-[var(--spacing-6)]">
          <h2 className="text-[length:var(--font-size-lg)] font-[var(--font-weight-semibold)] text-text-primary mb-[var(--spacing-3)]">
            {t('content.phases')}
          </h2>
          <ol className="space-y-[var(--spacing-2)]">
            {content.phases.map((phase, index) => (
              <li
                key={phase}
                className="flex items-start gap-[var(--spacing-2)] text-[length:var(--font-size-sm)] text-text-secondary"
              >
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-bg-tertiary text-[length:var(--font-size-xs)] font-[var(--font-weight-medium)] text-text-primary shrink-0">
                  {index + 1}
                </span>
                <span>{phase}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Fallback to inventory phases if content doesn't have them */}
      {(!content?.phases && skill.phases && skill.phases.length > 0) && (
        <section className="mb-[var(--spacing-6)]">
          <h2 className="text-[length:var(--font-size-lg)] font-[var(--font-weight-semibold)] text-text-primary mb-[var(--spacing-3)]">
            {t('content.phases')}
          </h2>
          <ol className="space-y-[var(--spacing-2)]">
            {skill.phases.map((phase, index) => (
              <li
                key={phase}
                className="flex items-start gap-[var(--spacing-2)] text-[length:var(--font-size-sm)] text-text-secondary"
              >
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-bg-tertiary text-[length:var(--font-size-xs)] font-[var(--font-weight-medium)] text-text-primary shrink-0">
                  {index + 1}
                </span>
                <span>{phase}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Allowed tools */}
      {content?.allowedTools && content.allowedTools.length > 0 && (
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

      {/* Path reference */}
      {skill.path && (
        <section className="mb-[var(--spacing-6)]">
          <h2 className="text-[length:var(--font-size-lg)] font-[var(--font-weight-semibold)] text-text-primary mb-[var(--spacing-3)]">
            {t('content.file_reference')}
          </h2>
          <code className="px-[var(--spacing-2)] py-[var(--spacing-1)] bg-bg-secondary border border-border rounded-[var(--radius-sm)] text-[length:var(--font-size-sm)] text-text-secondary">
            {skill.path}
          </code>
        </section>
      )}

      {/* Full documentation content */}
      {content?.rawContent && (
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
