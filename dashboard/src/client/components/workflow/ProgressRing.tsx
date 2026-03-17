// ---------------------------------------------------------------------------
// ProgressRing -- SVG circular progress indicator
// ---------------------------------------------------------------------------

interface ProgressRingProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}

export function ProgressRing({ progress, size = 28, strokeWidth = 3, color = 'var(--color-status-completed)' }: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(progress, 100) / 100) * circumference;

  return (
    <div className="relative inline-flex" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-text-primary"
        style={{ fontSize: size * 0.29, fontWeight: 700 }}
      >
        {Math.round(progress)}%
      </span>
    </div>
  );
}
