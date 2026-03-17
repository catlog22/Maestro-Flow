import { useEffect, useState } from 'react';
import { SettingsCard } from '../SettingsComponents.js';

// ---------------------------------------------------------------------------
// SpecsSection — read-only spec directory browser
// ---------------------------------------------------------------------------

interface SpecEntry {
  name: string;
  path: string;
  createdAt?: string;
}

export function SpecsSection() {
  const [specs, setSpecs] = useState<SpecEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchSpecs() {
      try {
        const res = await fetch('/api/settings/specs');
        if (!res.ok) throw new Error(`Failed to load specs: ${res.status}`);
        const data = (await res.json()) as { specs: SpecEntry[] };
        if (!cancelled) {
          setSpecs(data.specs ?? []);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load specs');
          setLoading(false);
        }
      }
    }

    void fetchSpecs();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-[var(--spacing-8)]">
        <span className="text-[length:var(--font-size-sm)] text-text-secondary">
          Loading specs...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <SettingsCard title="Specs" description="Could not load spec directory">
        <p className="text-[length:var(--font-size-sm)] text-status-blocked">{error}</p>
      </SettingsCard>
    );
  }

  if (specs.length === 0) {
    return (
      <SettingsCard
        title="Specifications"
        description="No specifications found in .workflow/.spec/"
      >
        <p className="text-[length:var(--font-size-sm)] text-text-secondary italic">
          Run the spec-generate pipeline to create specifications.
        </p>
      </SettingsCard>
    );
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-3)]">
      {specs.map((spec) => (
        <SettingsCard key={spec.name} title={spec.name} description={spec.path}>
          {spec.createdAt && (
            <span className="text-[length:var(--font-size-xs)] text-text-tertiary">
              Created: {spec.createdAt}
            </span>
          )}
        </SettingsCard>
      ))}
    </div>
  );
}
