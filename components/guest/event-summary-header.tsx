import { APP_NAME } from "@/lib/constants";
import LocalDateTime from "@/components/local-datetime";

type Props = {
  event: {
    title: string;
    venue_name: string | null;
    event_datetime: string;
    description: string | null;
  };
};

export default function EventSummaryHeader({ event }: Props) {
  return (
    <header
      className="border-b"
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="max-w-xl mx-auto px-4 py-8">
        <p className="text-sm font-medium mb-3" style={{ color: "var(--green)" }}>
          {APP_NAME}
        </p>
        <h1
          className="text-3xl leading-tight mb-2"
          style={{ fontFamily: "var(--font-dm-serif)", color: "var(--text)" }}
        >
          {event.title}
        </h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          <LocalDateTime iso={event.event_datetime} />
          {event.venue_name && <> &middot; {event.venue_name}</>}
        </p>
        {event.description && (
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            {event.description}
          </p>
        )}
      </div>
    </header>
  );
}
