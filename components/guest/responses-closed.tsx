import EventSummaryHeader from "./event-summary-header";

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
    title: string;
    venue_name: string | null;
    event_datetime: string;
    description: string | null;
    response_deadline: string;
  };
};

export default function ResponsesClosed({ event }: Props) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      <EventSummaryHeader event={event} />

      <main className="max-w-xl mx-auto px-4 py-10">
        <div
          className="rounded-[16px] p-6 text-center"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: "#FEF3C7" }}
          >
            <span style={{ fontSize: "1.5rem" }}>🔒</span>
          </div>
          <h2
            className="text-xl mb-2"
            style={{ fontFamily: "var(--font-dm-serif)", color: "var(--text)" }}
          >
            Responses are closed
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            The host stopped accepting responses on{" "}
            <span className="font-medium" style={{ color: "var(--text)" }}>
              {formatDatetime(event.response_deadline)}
            </span>
            . If you think this is a mistake, contact the host directly.
          </p>
        </div>
      </main>
    </div>
  );
}
