const inputClass = "w-full px-3 py-2.5 rounded-[10px] text-sm border";
const disabledStyle = {
  backgroundColor: "var(--bg)",
  borderColor: "var(--border-med)",
  color: "var(--muted)",
};

type Props = {
  response: {
    guest_name: string;
    guest_phone: string | null;
    notes: string | null;
    pick_names: string[];
  };
};

export default function GuestResponseReadOnly({ response }: Props) {
  return (
    <main className="max-w-xl mx-auto px-4 py-8 space-y-6">
      {/* Closed banner */}
      <div
        className="rounded-[10px] px-4 py-3 text-sm font-medium"
        style={{
          backgroundColor: "#FEF3C7",
          border: "1px solid #FDE68A",
          color: "#92400E",
        }}
      >
        Responses are closed. You can no longer change your response.
      </div>

      {/* Details */}
      <div
        className="rounded-[16px] p-6 space-y-5"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <h2 className="text-base font-medium" style={{ color: "var(--text)" }}>
          Your details
        </h2>

        <div>
          <p className="block text-sm font-medium mb-1" style={{ color: "var(--text)" }}>
            Your name
          </p>
          <input
            type="text"
            readOnly
            value={response.guest_name}
            className={inputClass}
            style={disabledStyle}
          />
        </div>

        {response.guest_phone && (
          <div>
            <p className="block text-sm font-medium mb-1" style={{ color: "var(--text)" }}>
              Phone number
            </p>
            <input
              type="text"
              readOnly
              value={response.guest_phone}
              className={inputClass}
              style={disabledStyle}
            />
          </div>
        )}
      </div>

      {/* Picks — show names only (full menu not needed for read-only display) */}
      {response.pick_names.length > 0 && (
        <div
          className="rounded-[16px] p-6 space-y-3"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <h2 className="text-base font-medium" style={{ color: "var(--text)" }}>
            Your picks
          </h2>
          <div className="space-y-1">
            {response.pick_names.map((name, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-[10px] px-3 py-3"
                style={{
                  backgroundColor: "var(--green-light)",
                  border: "1px solid var(--green-border)",
                }}
              >
                <span className="text-xs font-bold" style={{ color: "var(--green-text)" }}>
                  ✓
                </span>
                <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
                  {name}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {response.notes && (
        <div
          className="rounded-[16px] p-6"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <p className="block text-sm font-medium mb-1" style={{ color: "var(--text)" }}>
            Notes for the host
          </p>
          <textarea
            readOnly
            rows={3}
            value={response.notes}
            className={inputClass}
            style={disabledStyle}
          />
        </div>
      )}
    </main>
  );
}
