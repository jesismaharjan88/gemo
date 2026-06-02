import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EventSummaryHeader from "@/components/guest/event-summary-header";
import GuestForm from "@/components/guest/guest-form";
import ResponsesClosed from "@/components/guest/responses-closed";

// Slug format: lowercase letters, digits, hyphens, 3–80 chars.
const SLUG_RE = /^[a-z0-9-]{3,80}$/;

export default async function GuestPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (!SLUG_RE.test(slug)) notFound();

  // No auth session for guests — createClient() falls back to anon role.
  // RLS: events_anon_select_active only returns active events.
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select(
      "id, slug, title, venue_name, event_datetime, description, max_picks_per_guest, response_deadline"
    )
    .eq("slug", slug)
    .single();

  // Not found = event doesn't exist OR is draft/closed — same outcome, no existence leak.
  if (!event) notFound();

  const { data: menuItems } = await supabase
    .from("menu_items")
    .select("id, name, description, category, sort_order")
    .eq("event_id", event.id)
    .order("sort_order");

  // Belt-and-suspenders deadline check at render time.
  const deadlinePassed =
    event.response_deadline != null &&
    new Date(event.response_deadline) < new Date();

  if (deadlinePassed) {
    return <ResponsesClosed event={event} />;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      <EventSummaryHeader event={event} />
      <GuestForm
        eventId={event.id}
        slug={event.slug}
        maxPicksPerGuest={event.max_picks_per_guest}
        menuItems={menuItems ?? []}
      />
    </div>
  );
}
