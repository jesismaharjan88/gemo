import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EventEditForm from "@/components/events/event-edit-form";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Reject non-UUID strings before hitting Postgres (avoids 22P02 error).
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select(
      "id, slug, title, venue_name, event_datetime, description, max_picks_per_guest, response_deadline, status"
    )
    .eq("id", id)
    .single();

  // 22P02 = invalid_text_representation (malformed UUID reaching Postgres)
  if (eventError?.code === "22P02") notFound();
  if (!event) notFound();

  // Closed events cannot be edited — redirect cleanly to the detail page.
  if (event.status === "closed") redirect(`/dashboard/events/${id}`);

  const [menuItemsResult, responseCountResult] = await Promise.all([
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

  const menuItems = menuItemsResult.data ?? [];
  const responseCount = responseCountResult.count ?? 0;

  // Full edit mode: no responses yet, or still a draft.
  const mode: "full" | "metadata" =
    event.status === "draft" || responseCount === 0 ? "full" : "metadata";

  return (
    <EventEditForm
      event={event}
      menuItems={menuItems}
      mode={mode}
      responseCount={responseCount}
    />
  );
}
