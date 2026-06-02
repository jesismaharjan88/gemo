import type { EventCardData } from "./types";
import EventCard from "./event-card";

export default function EventSection({
  title,
  emptyLabel,
  events,
}: {
  title: string;
  emptyLabel: string;
  events: EventCardData[];
}) {
  return (
    <section>
      <h2
        className="text-2xl mb-4"
        style={{ fontFamily: "var(--font-dm-serif)", color: "var(--text)" }}
      >
        {title}
      </h2>
      {events.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          {emptyLabel}
        </p>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <EventCard key={event.id} {...event} />
          ))}
        </div>
      )}
    </section>
  );
}
