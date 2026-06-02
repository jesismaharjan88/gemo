type Props = {
  pickNames: string[];
  notes: string | null;
};

export default function OrderSummary({ pickNames, notes }: Props) {
  return (
    <div
      className="rounded-[16px] p-6 space-y-4"
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <h2 className="text-base font-medium" style={{ color: "var(--text)" }}>
        Here&apos;s what you picked
      </h2>

      {pickNames.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          No dishes found — the menu may have changed.
        </p>
      ) : (
        <ul className="space-y-1">
          {pickNames.map((name, i) => (
            <li key={i} className="flex items-center gap-2.5 text-sm">
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: "var(--green)" }}
              />
              <span style={{ color: "var(--text)" }}>{name}</span>
            </li>
          ))}
        </ul>
      )}

      {notes && (
        <div
          className="rounded-[10px] px-4 py-3 text-sm"
          style={{ backgroundColor: "var(--bg)", border: "1px solid var(--border)" }}
        >
          <span className="font-medium" style={{ color: "var(--subtle)" }}>
            Your note:{" "}
          </span>
          <span style={{ color: "var(--text)" }}>{notes}</span>
        </div>
      )}
    </div>
  );
}
