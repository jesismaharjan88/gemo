function formatDatetime(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

type Props = {
  event: {
    venue_name: string | null;
    event_datetime: string;
    response_deadline: string;
    max_picks_per_guest: number;
    description: string | null;
  };
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--subtle)" }}>
        {label}
      </span>
      <span className="text-sm" style={{ color: "var(--text)" }}>
        {children}
      </span>
    </div>
  );
}

export default function EventDetailsCard({ event }: Props) {
  return (
    <div
      className="rounded-[16px] p-6 space-y-4"
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <h2 className="text-base font-medium" style={{ color: "var(--text)" }}>
        Event details
      </h2>

      <div className="space-y-3">
        {event.venue_name && (
          <Row label="Venue">{event.venue_name}</Row>
        )}
        <Row label="Date &amp; time">{formatDatetime(event.event_datetime)}</Row>
        <Row label="Response deadline">{formatDatetime(event.response_deadline)}</Row>
        <Row label="Max picks per guest">{event.max_picks_per_guest}</Row>
        {event.description && (
          <Row label="Description">
            <span style={{ whiteSpace: "pre-wrap" }}>{event.description}</span>
          </Row>
        )}
      </div>
    </div>
  );
}
