type Props = { responseCount: number };

export default function ResponsesPlaceholder({ responseCount }: Props) {
  return (
    <div
      className="rounded-[16px] p-6 flex items-center justify-between"
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div>
        <h2 className="text-base font-medium" style={{ color: "var(--text)" }}>
          Responses
        </h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
          {responseCount === 0
            ? "No responses yet"
            : `${responseCount} response${responseCount === 1 ? "" : "s"} received`}
        </p>
      </div>
      <span
        className="text-xs px-2.5 py-1 rounded-full"
        style={{ backgroundColor: "var(--bg)", color: "var(--subtle)" }}
      >
        Detailed view coming soon
      </span>
    </div>
  );
}
