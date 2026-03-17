import { useI18n } from '@/client/i18n/index.js';
import type { Category, Command, Skill } from '@/client/routes/route-config.js';
import { Link } from 'react-router-dom';

// ---------------------------------------------------------------------------
// CategoryPage — displays all commands and skills in a category
// ---------------------------------------------------------------------------

interface CategoryPageProps {
  categoryId: string;
  category: Category;
  commands: Command[];
  claudeSkills: Skill[];
  codexSkills: Skill[];
}

export default function CategoryPage({
  categoryId,
  category,
  commands,
  claudeSkills,
  codexSkills,
}: CategoryPageProps) {
  const { t } = useI18n();

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-[var(--spacing-6)]">
        <div className="flex items-center gap-[var(--spacing-2)] mb-[var(--spacing-2)]">
          <span className="text-2xl">{getCategoryIcon(categoryId)}</span>
          <h1 className="text-[length:var(--font-size-2xl)] font-[var(--font-weight-bold)] text-text-primary">
            {category.name}
          </h1>
        </div>
        <p className="text-[length:var(--font-size-base)] text-text-secondary">
          {category.description}
        </p>
      </div>

      {/* Commands section */}
      {commands.length > 0 && (
        <section className="mb-[var(--spacing-6)]">
          <h2 className="text-[length:var(--font-size-lg)] font-[var(--font-weight-semibold)] text-text-primary mb-[var(--spacing-3)]">
            {t('sidebar.commands')} ({commands.length})
          </h2>
          <div className="space-y-[var(--spacing-2)]">
            {commands.map((cmd) => (
              <CommandCard key={cmd.name} command={cmd} categoryId={categoryId} />
            ))}
          </div>
        </section>
      )}

      {/* Claude Skills section */}
      {claudeSkills.length > 0 && (
        <section className="mb-[var(--spacing-6)]">
          <h2 className="text-[length:var(--font-size-lg)] font-[var(--font-weight-semibold)] text-text-primary mb-[var(--spacing-3)]">
            {t('sidebar.skills')} ({claudeSkills.length})
          </h2>
          <div className="space-y-[var(--spacing-2)]">
            {claudeSkills.map((skill) => (
              <SkillCard key={skill.name} skill={skill} skillType="claude" />
            ))}
          </div>
        </section>
      )}

      {/* Codex Skills section */}
      {codexSkills.length > 0 && (
        <section className="mb-[var(--spacing-6)]">
          <h2 className="text-[length:var(--font-size-lg)] font-[var(--font-weight-semibold)] text-text-primary mb-[var(--spacing-3)]">
            {t('sidebar.codex_skills')} ({codexSkills.length})
          </h2>
          <div className="space-y-[var(--spacing-2)]">
            {codexSkills.map((skill) => (
              <SkillCard key={skill.name} skill={skill} skillType="codex" />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CommandCard — command link card
// ---------------------------------------------------------------------------

interface CommandCardProps {
  command: Command;
  categoryId: string;
}

function CommandCard({ command, categoryId }: CommandCardProps) {
  const slug = getCommandSlug(command.name);

  return (
    <Link
      to={`/${categoryId}/${slug}`}
      className={[
        'block p-[var(--spacing-3)] rounded-[var(--radius-default)]',
        'bg-bg-secondary border border-border',
        'transition-all duration-[var(--duration-fast)]',
        'hover:bg-bg-hover hover:border-border-focused',
        'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-[var(--spacing-2)]">
        <div className="min-w-0 flex-1">
          <h3 className="text-[length:var(--font-size-base)] font-[var(--font-weight-medium)] text-text-primary mb-1">
            {command.name}
          </h3>
          <p className="text-[length:var(--font-size-sm)] text-text-secondary line-clamp-2">
            {command.description}
          </p>
        </div>
        <svg
          className="w-5 h-5 text-text-tertiary shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// SkillCard — skill link card
// ---------------------------------------------------------------------------

interface SkillCardProps {
  skill: Skill;
  skillType: 'claude' | 'codex';
}

function SkillCard({ skill, skillType }: SkillCardProps) {
  const href = skillType === 'claude' ? `/skills/${skill.name}` : `/codex/${skill.name}`;

  return (
    <Link
      to={href}
      className={[
        'block p-[var(--spacing-3)] rounded-[var(--radius-default)]',
        'bg-bg-secondary border border-border',
        'transition-all duration-[var(--duration-fast)]',
        'hover:bg-bg-hover hover:border-border-focused',
        'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-[var(--spacing-2)]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[var(--spacing-2)] mb-1">
            <h3 className="text-[length:var(--font-size-base)] font-[var(--font-weight-medium)] text-text-primary">
              {skill.name}
            </h3>
            <span
              className={[
                'px-1.5 py-0.5 text-[length:var(--font-size-xs)] rounded-sm',
                'font-[var(--font-weight-medium)]',
                skillType === 'claude' ? 'bg-accent-purple/10 text-accent-purple' : 'bg-accent-orange/10 text-accent-orange',
              ].join(' ')}
            >
              {skillType === 'claude' ? 'Claude' : 'Codex'}
            </span>
          </div>
          <p className="text-[length:var(--font-size-sm)] text-text-secondary line-clamp-2">
            {skill.description}
          </p>
          {skill.roles && (
            <p className="text-[length:var(--font-size-xs)] text-text-tertiary mt-1">
              Roles: {skill.roles.join(', ')}
            </p>
          )}
        </div>
        <svg
          className="w-5 h-5 text-text-tertiary shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}

// Helper functions
function getCommandSlug(commandName: string): string {
  const parts = commandName.split('-');
  return parts.length > 1 ? parts.slice(1).join('-') : commandName;
}

function getCategoryIcon(categoryId: string): string {
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
