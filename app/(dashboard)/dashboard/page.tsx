import { createClient } from "@/lib/supabase/server";
import type { EventCardData, EventStatus } from "@/components/dashboard/types";
import DashboardHeader from "@/components/dashboard/dashboard-header";
import EventSection from "@/components/dashboard/event-section";
import EmptyDashboardState from "@/components/dashboard/empty-dashboard-state";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Layout already guards auth + onboarding; this is a safety net only.
  if (!user) return null;

  // Host name for greeting
  const { data: host } = await supabase
    .from("hosts")
    .select("name")
    .single();

  // Fetch this host's events. Order by created_at DESC so the JS draft sort
  // can rely on array position instead of re-sorting without the field.
  const { data: rawEvents } = await supabase
    .from("events")
    .select("id, slug, title, venue_name, event_datetime, status, response_deadline, created_at")
    .eq("host_id", user.id)
    .order("created_at", { ascending: false });

  const events = rawEvents ?? [];

  // Fetch response counts only when there are events
  const responseCounts = new Map<string, number>();
  if (events.length > 0) {
    const eventIds = events.map((e) => e.id);
    const { data: responseRows } = await supabase
      .from("responses")
      .select("event_id")
      .in("event_id", eventIds);

    for (const row of responseRows ?? []) {
      responseCounts.set(row.event_id, (responseCounts.get(row.event_id) ?? 0) + 1);
    }
  }

  // Map to EventCardData, filtering out archived
  const cards: EventCardData[] = events
    .filter((e) => e.status !== "archived")
    .map((e) => ({
      id: e.id,
      slug: e.slug,
      title: e.title,
      venue: e.venue_name ?? null,
      datetime: e.event_datetime,
      createdAt: e.created_at,
      status: e.status as EventStatus,
      responseCount: responseCounts.get(e.id) ?? 0,
    }));

  if (cards.length === 0) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
        <DashboardHeader
          hostName={host?.name ?? ""}
          hostEmail={user.email ?? ""}
        />
        <main className="max-w-4xl mx-auto px-6 py-12">
          <EmptyDashboardState />
        </main>
      </div>
    );
  }

  // Partition and sort
  const activeEvents = cards
    .filter((e) => e.status === "active")
    .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

  const draftEvents = cards
    .filter((e) => e.status === "draft")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const pastEvents = cards
    .filter((e) => e.status === "closed")
    .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      <DashboardHeader
        hostName={host?.name ?? ""}
        hostEmail={user.email ?? ""}
      />
      <main className="max-w-4xl mx-auto px-6 py-10 space-y-10">
        <EventSection
          title="Active"
          emptyLabel="No active events"
          events={activeEvents}
        />
        <EventSection
          title="Drafts"
          emptyLabel="No drafts"
          events={draftEvents}
        />
        <EventSection
          title="Past"
          emptyLabel="No past events"
          events={pastEvents}
        />
      </main>
    </div>
  );
}
