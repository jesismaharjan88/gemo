const STEPS = ["Details", "Menu", "Review"] as const;

export default function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  return (
    <nav aria-label="Form steps" className="flex items-center gap-2">
      {STEPS.map((label, i) => {
        const step = (i + 1) as 1 | 2 | 3;
        const isActive = step === current;
        const isDone = step < current;
        return (
          <div key={label} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span
                aria-current={isActive ? "step" : undefined}
                className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-colors"
                style={{
                  backgroundColor: isActive
                    ? "var(--green)"
                    : isDone
                    ? "var(--green-light)"
                    : "var(--border-med)",
                  color: isActive
                    ? "#fff"
                    : isDone
                    ? "var(--green-text)"
                    : "var(--muted)",
                }}
              >
                {isDone ? "✓" : step}
              </span>
              <span
                className="text-sm hidden sm:inline"
                style={{ color: isActive ? "var(--text)" : "var(--muted)", fontWeight: isActive ? 500 : 400 }}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="h-px w-6"
                style={{ backgroundColor: "var(--border-med)" }}
                aria-hidden
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}
