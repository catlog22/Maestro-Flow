// ---------------------------------------------------------------------------
// FilterChipBar — horizontal chip row with active toggle
// ---------------------------------------------------------------------------

interface FilterChipBarProps {
  chips: string[];
  active: string;
  onSelect: (chip: string) => void;
}

export function FilterChipBar({ chips, active, onSelect }: FilterChipBarProps) {
  return (
    <div className="flex items-center gap-[var(--spacing-1-5)] overflow-x-auto shrink-0">
      {chips.map((chip) => {
        const isActive = chip === active;
        return (
          <button
            key={chip}
            type="button"
            onClick={() => onSelect(chip)}
            className={[
              'px-[var(--spacing-3)] py-[var(--spacing-1)] rounded-full',
              'text-[length:var(--font-size-xs)] font-[var(--font-weight-medium)] whitespace-nowrap',
              'border transition-all duration-[var(--duration-fast)] ease-[var(--ease-notion)]',
              'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
              isActive
                ? 'bg-text-primary text-text-inverse border-text-primary'
                : 'bg-bg-card text-text-secondary border-border hover:border-text-tertiary hover:text-text-primary',
            ].join(' ')}
          >
            {chip}
          </button>
        );
      })}
    </div>
  );
}
