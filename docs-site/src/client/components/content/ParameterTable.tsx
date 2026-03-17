import { useI18nContext } from '@/client/i18n/index.js';

// ---------------------------------------------------------------------------
// ParameterTable -- Command parameters table with required/optional indicators
// ---------------------------------------------------------------------------

export interface Parameter {
  name: string;
  type: string;
  required: boolean;
  default?: string;
  description: string;
}

interface ParameterTableProps {
  parameters: Parameter[];
}

export function ParameterTable({ parameters }: ParameterTableProps) {
  const { t } = useI18nContext();

  if (parameters.length === 0) {
    return null;
  }

  return (
    <div className="my-[var(--spacing-4)]">
      <h3 className="text-[length:var(--font-size-md)] font-[var(--font-weight-semibold)] text-text-primary mb-[var(--spacing-3)]">
        {t('content.parameters')}
      </h3>
      <div className="overflow-x-auto border border-border rounded-[var(--radius-default)]">
        <table className="min-w-full">
          <thead className="bg-bg-secondary">
            <tr>
              <th className="px-[var(--spacing-3)] py-[var(--spacing-2)] text-left text-[length:var(--font-size-xs)] font-[var(--font-weight-semibold)] text-text-secondary border-b border-border">
                {t('content.parameters')}
              </th>
              <th className="px-[var(--spacing-3)] py-[var(--spacing-2)] text-left text-[length:var(--font-size-xs)] font-[var(--font-weight-semibold)] text-text-secondary border-b border-border">
                {t('content.type')}
              </th>
              <th className="px-[var(--spacing-3)] py-[var(--spacing-2)] text-left text-[length:var(--font-size-xs)] font-[var(--font-weight-semibold)] text-text-secondary border-b border-border">
                {t('content.default')}
              </th>
              <th className="px-[var(--spacing-3)] py-[var(--spacing-2)] text-left text-[length:var(--font-size-xs)] font-[var(--font-weight-semibold)] text-text-secondary border-b border-border">
                {t('content.description')}
              </th>
            </tr>
          </thead>
          <tbody>
            {parameters.map((param) => (
              <tr
                key={param.name}
                className={[
                  'border-b border-border last:border-b-0',
                  'hover:bg-bg-hover transition-colors duration-[var(--duration-fast)]',
                ].join(' ')}
              >
                <td className="px-[var(--spacing-3)] py-[var(--spacing-2)]">
                  <div className="flex items-center gap-[var(--spacing-2)]">
                    <code className="text-[length:var(--font-size-sm)] font-mono text-accent-blue">
                      {param.name}
                    </code>
                    <RequiredBadge required={param.required} />
                  </div>
                </td>
                <td className="px-[var(--spacing-3)] py-[var(--spacing-2)]">
                  <TypeBadge type={param.type} />
                </td>
                <td className="px-[var(--spacing-3)] py-[var(--spacing-2)]">
                  <span className="text-[length:var(--font-size-sm)] text-text-tertiary font-mono">
                    {param.default ?? '-'}
                  </span>
                </td>
                <td className="px-[var(--spacing-3)] py-[var(--spacing-2)]">
                  <p className="text-[length:var(--font-size-sm)] text-text-secondary leading-snug">
                    {param.description}
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function RequiredBadge({ required }: { required: boolean }) {
  const { t } = useI18nContext();

  if (required) {
    return (
      <span
        className={[
          'text-[length:var(--font-size-xs)] px-[var(--spacing-1)] py-[var(--spacing-0-5)] rounded-[var(--radius-sm)]',
          'bg-bg-error/10 text-status-error font-[var(--font-weight-medium)]',
        ].join(' ')}
        aria-label={t('content.required')}
      >
        {t('content.required')}
      </span>
    );
  }

  return (
    <span
      className={[
        'text-[length:var(--font-size-xs)] px-[var(--spacing-1)] py-[var(--spacing-0-5)] rounded-[var(--radius-sm)]',
        'bg-bg-tertiary/50 text-text-tertiary font-[var(--font-weight-medium)]',
      ].join(' ')}
      aria-label={t('content.optional')}
    >
      {t('content.optional')}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    string: 'text-accent-blue',
    number: 'text-accent-green',
    boolean: 'text-accent-yellow',
    array: 'text-accent-purple',
    object: 'text-accent-orange',
  };

  const colorClass = colors[type] ?? 'text-text-secondary';

  return (
    <span
      className={[
        'text-[length:var(--font-size-xs)] font-mono font-[var(--font-weight-medium)]',
        colorClass,
      ].join(' ')}
    >
      {type}
    </span>
  );
}
