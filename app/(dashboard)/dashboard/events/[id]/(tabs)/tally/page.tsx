export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TallyView from "@/components/events/tally-view";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function TallyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();

  const [eventResult, menuItemsResult, responsesResult] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, venue_name, event_datetime, status, expected_guest_count")
      .eq("id", id)
      .single(),
    supabase
      .from("menu_items")
      .select("id, name, description, category, sort_order")
      .eq("event_id", id)
      .order("sort_order"),
    supabase.from("responses").select("id").eq("event_id", id),
  ]);

  if (eventResult.error?.code === "22P02") notFound();
  if (!eventResult.data) notFound();

  const menuItems = menuItemsResult.data ?? [];
  const responseIds = (responsesResult.data ?? []).map((r) => r.id);

  const picks =
    responseIds.length > 0
      ? (
          await supabase
            .from("response_picks")
            .select("menu_item_id")
            .in("response_id", responseIds)
        ).data ?? []
      : [];

  const initialPickCounts: Record<string, number> = {};
  for (const pick of picks) {
    initialPickCounts[pick.menu_item_id] =
      (initialPickCounts[pick.menu_item_id] ?? 0) + 1;
  }

  return (
    <TallyView
      eventId={id}
      menuItems={menuItems}
      initialRespondedCount={responseIds.length}
      initialPickCounts={initialPickCounts}
      initialExpectedCount={eventResult.data.expected_guest_count}
    />
  );
}
