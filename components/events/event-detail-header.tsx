import Link from "next/link";
import { APP_NAME } from "@/lib/constants";
import LocalDateTime from "@/components/local-datetime";

const STATUS_STYLES: Record<string, { label: string; bg: string; color: string }> = {
  active: { label: "Active", bg: "var(--green-light)", color: "var(--green-text)" },
  draft: { label: "Draft", bg: "#FEF3C7", color: "#92400E" },
  closed: { label: "Closed", bg: "#F3F4F6", color: "#6B7280" },
};

type Props = {
  event: {
    id: string;
    title: string;
    venue_name: string | null;
    event_datetime: string;
    status: string;
  };
};

export default function EventDetailHeader({ event }: Props) {
  const pill = STATUS_STYLES[event.status] ?? STATUS_STYLES.closed;

  return (
    <>
      <header
        className="border-b px-6 py-4 flex items-center justify-between"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <Link
          href="/dashboard"
          className="text-xl"
          style={{ fontFamily: "var(--font-dm-serif)", color: "var(--text)" }}
        >
          {APP_NAME}
        </Link>
        <Link
          href="/dashboard"
          className="text-sm font-medium px-4 py-2 rounded-[10px]"
          style={{ color: "var(--muted)" }}
        >
          ← Dashboard
        </Link>
      </header>

      <div
        className="border-b px-4 py-8"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="max-w-2xl mx-auto">
          <div className="flex items-start justify-between gap-4">
            <h1
              className="text-3xl leading-tight"
              style={{ fontFamily: "var(--font-dm-serif)", color: "var(--text)" }}
            >
              {event.title}
            </h1>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span
                className="text-xs font-medium px-2.5 py-1 rounded-full"
                style={{ backgroundColor: pill.bg, color: pill.color }}
              >
                {pill.label}
              </span>
              {event.status !== "closed" && (
                <Link
                  href={`/dashboard/events/${event.id}/edit`}
                  className="px-4 py-2 rounded-[10px] text-sm font-medium border transition-colors"
                  style={{ borderColor: "var(--border-med)", color: "var(--muted)" }}
                >
                  Edit
                </Link>
              )}
            </div>
          </div>

          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            <LocalDateTime
              iso={event.event_datetime}
              options={{ weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }}
            />
            {event.venue_name && <> &middot; {event.venue_name}</>}
          </p>
        </div>
      </div>
    </>
  );
}
