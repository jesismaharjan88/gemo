import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EventActions from "@/components/events/event-actions";
import ShareLinkBox from "@/components/events/share-link-box";
import EventDetailsCard from "@/components/events/event-details-card";
import MenuItemsCard from "@/components/events/menu-items-card";
import ResponsesPlaceholder from "@/components/events/responses-placeholder";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();

  const [eventResult, menuItemsResult, responseCountResult] = await Promise.all([
    supabase
      .from("events")
      .select(
        "id, slug, title, venue_name, event_datetime, description, max_picks_per_guest, response_deadline, status"
      )
      .eq("id", id)
      .single(),
    supabase
      .from("menu_items")
      .select("name, description, category, sort_order")
      .eq("event_id", id)
      .order("sort_order"),
    supabase
      .from("responses")
      .select("id", { count: "exact", head: true })
      .eq("event_id", id),
  ]);

  if (eventResult.error?.code === "22P02") notFound();
  if (!eventResult.data) notFound();

  const event = eventResult.data;
  const menuItems = menuItemsResult.data ?? [];
  const responseCount = responseCountResult.count ?? 0;

  return (
    <main className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <EventActions eventId={event.id} status={event.status} />

      {event.status === "active" && (
        <ShareLinkBox slug={event.slug} />
      )}

      <EventDetailsCard event={event} />
      <MenuItemsCard menuItems={menuItems} />
      <ResponsesPlaceholder responseCount={responseCount} />
    </main>
  );
}
