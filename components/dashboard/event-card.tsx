import Link from "next/link";
import type { EventCardData } from "./types";

const STATUS_STYLES: Record<string, { label: string; bg: string; color: string }> = {
  active: { label: "Active", bg: "var(--green-light)", color: "var(--green-text)" },
  draft: { label: "Draft", bg: "#FEF3C7", color: "#92400E" },
  closed: { label: "Closed", bg: "#F3F4F6", color: "#6B7280" },
};

function formatDatetime(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function EventCard({ id, title, venue, datetime, status, responseCount }: EventCardData) {
  const pill = STATUS_STYLES[status] ?? STATUS_STYLES.closed;

  return (
    <Link
      href={`/dashboard/events/${id}`}
      className="block rounded-[16px] p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <h3
          className="text-lg leading-snug"
          style={{ fontFamily: "var(--font-dm-serif)", color: "var(--text)" }}
        >
          {title}
        </h3>
        <span
          className="flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full"
          style={{ backgroundColor: pill.bg, color: pill.color }}
        >
          {pill.label}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" style={{ color: "var(--muted)" }}>
        <span>{formatDatetime(datetime)}</span>
        {venue && <span>{venue}</span>}
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: responseCount > 0 ? "var(--green-light)" : "var(--bg)",
            color: responseCount > 0 ? "var(--green-text)" : "var(--muted)",
          }}
        >
          {responseCount > 0 ? `${responseCount} response${responseCount === 1 ? "" : "s"}` : "No responses yet"}
        </span>
      </div>
    </Link>
  );
}
