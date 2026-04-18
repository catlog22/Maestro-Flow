import { List } from 'lucide-react';

// ---------------------------------------------------------------------------
// PropertiesPanel -- displays file/selection metadata
// ---------------------------------------------------------------------------
// - Shows properties for the currently previewed or selected file
// - Displays: name, path, size, type, last modified
// - Empty state when no file is selected
// ---------------------------------------------------------------------------

interface FileProperties {
  name: string;
  path: string;
  size: string;
  type: string;
  modified: string;
}

const SAMPLE_PROPERTIES: FileProperties = {
  name: '-',
  path: '-',
  size: '-',
  type: '-',
  modified: '-',
};

export function PropertiesPanel() {
  // Static panel showing property structure.
  // Real data will flow from file selection / workspace tree events.
  const properties = SAMPLE_PROPERTIES;

  return (
    <div className="flex flex-col h-full">
      <div className="px-[var(--spacing-3)] py-[var(--spacing-2)]">
        <h3 className="text-[length:var(--font-size-xs)] font-[var(--font-weight-semibold)] text-text-secondary uppercase tracking-[var(--letter-spacing-wide)] mb-[var(--spacing-2)]">
          File Properties
        </h3>
      </div>
      <div className="flex-1 overflow-auto px-[var(--spacing-3)]">
        <PropertiesTable properties={properties} />
      </div>
    </div>
  );
}

function PropertiesTable({ properties }: { properties: FileProperties }) {
  const entries: Array<{ label: string; value: string }> = [
    { label: 'Name', value: properties.name },
    { label: 'Path', value: properties.path },
    { label: 'Size', value: properties.size },
    { label: 'Type', value: properties.type },
    { label: 'Modified', value: properties.modified },
  ];

  return (
    <dl className="space-y-[var(--spacing-2)]">
      {entries.map((entry) => (
        <div key={entry.label} className="flex flex-col gap-[var(--spacing-0-5)]">
          <dt className="text-[length:var(--font-size-xs)] text-text-tertiary">
            {entry.label}
          </dt>
          <dd className="text-[length:var(--font-size-xs)] text-text-primary break-all">
            {entry.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
