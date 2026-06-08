"use client";

import { useState } from "react";
import { toast } from "sonner";

type OrderItem = { name: string; count: number; plates: number };
type OrderGroup = { category: string; items: OrderItem[] };
type Person = { id: string; guestName: string; dishes: string[]; notes: string | null };

type Props = {
  event: {
    title: string;
    formattedDatetime: string | null;
    venueName: string | null;
    venueAddress: string | null;
  };
  responseCount: number;
  orderGroups: OrderGroup[];
  perPerson: Person[];
};

function buildWhatsAppText(
  event: Props["event"],
  responseCount: number,
  orderGroups: OrderGroup[],
  perPerson: Person[],
  includePerPerson: boolean
): string {
  const lines: string[] = [];

  lines.push(`*${event.title}*`);
  if (event.formattedDatetime) lines.push(event.formattedDatetime);

  const venue = [event.venueName, event.venueAddress].filter(Boolean).join(", ");
  if (venue) lines.push(venue);

  lines.push("");
  lines.push(`Total responses: ${responseCount}`);

  if (orderGroups.length === 0) {
    lines.push("");
    lines.push("No orders yet.");
  } else {
    lines.push("");
    lines.push("*Order summary*");
    for (const group of orderGroups) {
      lines.push("");
      lines.push(group.category);
      for (const item of group.items) {
        lines.push(
          `- ${item.name} x${item.count}  (~${item.plates} plate${item.plates !== 1 ? "s" : ""})`
        );
      }
    }
  }

  if (includePerPerson && perPerson.length > 0) {
    lines.push("");
    lines.push("*Per person*");
    for (const p of perPerson) {
      const dishStr = p.dishes.length > 0 ? p.dishes.join(", ") : "no picks";
      const noteStr = p.notes ? ` — note: ${p.notes}` : "";
      lines.push(`${p.guestName}: ${dishStr}${noteStr}`);
    }
  }

  return lines.join("\n");
}

export default function ExportView({
  event,
  responseCount,
  orderGroups,
  perPerson,
}: Props) {
  const [includePerPerson, setIncludePerPerson] = useState(false);
  const [copied, setCopied] = useState(false);

  const venueStr = [event.venueName, event.venueAddress].filter(Boolean).join(", ");

  function handleCopy() {
    const text = buildWhatsAppText(
      event,
      responseCount,
      orderGroups,
      perPerson,
      includePerPerson
    );
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {
        toast.error("Clipboard unavailable — select and copy the text manually");
      }
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      {/* Controls — hidden in print */}
      <div className="flex items-center justify-between gap-4 print:hidden">
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includePerPerson}
            onChange={(e) => setIncludePerPerson(e.target.checked)}
            className="w-4 h-4 rounded accent-[var(--green)]"
          />
          <span className="text-sm" style={{ color: "var(--muted)" }}>
            Include per-person breakdown
          </span>
        </label>

        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-[10px] font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: copied ? "#0F6E56" : "var(--green)" }}
        >
          {copied ? (
            "Copied!"
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <rect x="4.5" y="4.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M4.5 9.5H3a1.5 1.5 0 0 1-1.5-1.5V3A1.5 1.5 0 0 1 3 1.5h5A1.5 1.5 0 0 1 9.5 3v1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              Copy as WhatsApp message
            </>
          )}
        </button>
      </div>

      {/* ── Export artifact (printable) ────────────────────────────────────── */}
      <div
        id="export-artifact"
        className="rounded-[16px] p-8 space-y-6 print:rounded-none print:border-0 print:p-0 print:shadow-none"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        {/* Header */}
        <div className="space-y-1 pb-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h1
            className="text-2xl leading-tight"
            style={{ fontFamily: "var(--font-dm-serif)", color: "var(--text)" }}
          >
            {event.title}
          </h1>
          {event.formattedDatetime && (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              {event.formattedDatetime}
            </p>
          )}
          {venueStr && (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              {venueStr}
            </p>
          )}
          <p className="text-sm pt-1 font-medium" style={{ color: "var(--text)" }}>
            Total responses: {responseCount}
          </p>
        </div>

        {/* Order summary */}
        {orderGroups.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-base font-medium" style={{ color: "var(--text)" }}>
              No responses yet
            </p>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
              No orders to show — share the event to start collecting picks
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <h2
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: "var(--subtle)" }}
            >
              Order summary
            </h2>
            {orderGroups.map((group) => (
              <section key={group.category}>
                <p
                  className="text-xs font-medium uppercase tracking-wider mb-2"
                  style={{ color: "var(--subtle)" }}
                >
                  {group.category}
                </p>
                <div className="space-y-1.5">
                  {group.items.map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between gap-4 py-1.5"
                      style={{ borderBottom: "1px solid var(--border)" }}
                    >
                      <span className="text-sm" style={{ color: "var(--text)" }}>
                        {item.name}
                      </span>
                      <span
                        className="text-sm tabular-nums flex-shrink-0"
                        style={{ color: "var(--muted)" }}
                      >
                        {item.count} picked &middot; ~{item.plates} plate
                        {item.plates !== 1 ? "s" : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Per-person appendix — conditionally rendered */}
        {includePerPerson && perPerson.length > 0 && (
          <div className="space-y-3 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
            <h2
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: "var(--subtle)" }}
            >
              Per person
            </h2>
            <div className="space-y-2">
              {perPerson.map((p) => (
                <div
                  key={p.id}
                  className="text-sm"
                  style={{ color: "var(--text)" }}
                >
                  <span className="font-medium">{p.guestName}</span>
                  {p.dishes.length > 0 ? (
                    <span style={{ color: "var(--muted)" }}>
                      {" — "}{p.dishes.join(", ")}
                    </span>
                  ) : (
                    <span style={{ color: "var(--subtle)" }}> — no picks</span>
                  )}
                  {p.notes && (
                    <span
                      className="block text-xs mt-0.5 pl-4"
                      style={{ color: "var(--subtle)" }}
                    >
                      Note: {p.notes}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
