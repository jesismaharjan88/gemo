import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EventSummaryHeader from "@/components/guest/event-summary-header";
import GuestEditForm from "@/components/guest/guest-edit-form";
import GuestResponseReadOnly from "@/components/guest/guest-response-readonly";

const SLUG_RE = /^[a-z0-9-]{3,80}$/;
// Tokens are 16-char lowercase hex strings (8 random bytes → hex-encoded).
const TOKEN_RE = /^[0-9a-f]{16}$/;

type TokenResponse = {
  id: string;
  event_id: string;
  guest_name: string;
  guest_phone: string | null;
  notes: string | null;
  pick_ids: string[];
  pick_names: string[];
  submitted_at: string;
  event_slug: string;
  event_title: string;
  event_venue_name: string | null;
  event_datetime: string;
  event_description: string | null;
  event_status: string;
};

export default async function EditPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;

  if (!SLUG_RE.test(slug)) notFound();
  if (!TOKEN_RE.test(token)) notFound();

  const supabase = await createClient();

  // Run both queries concurrently.
  // - eventResult: anon RLS only returns active events; null means closed/draft/missing.
  // - tokenResult: SECURITY DEFINER, status-independent — works even for closed events.
  const [eventResult, tokenResult] = await Promise.all([
    supabase
      .from("events")
      .select(
        "id, slug, title, venue_name, event_datetime, description, max_picks_per_guest, response_deadline"
      )
      .eq("slug", slug)
      .single(),
    supabase.rpc("get_response_by_token", { p_token: token }),
  ]);

  // Token must resolve — garbage or unknown token → 404 (no leak).
  if (tokenResult.error || !tokenResult.data) notFound();

  const response = tokenResult.data as TokenResponse;

  // Cross-event guard: the token's own event_slug must match the URL slug.
  // This works even when the event is closed (anon RLS would hide it, but the
  // RPC returns event_slug regardless of status). Prevents /e/B-slug/edit/A-token.
  if (response.event_slug !== slug) notFound();

  const event = eventResult.data;

  // Belt-and-suspenders deadline check (event can be non-null and active, but past deadline).
  const deadlinePassed =
    event?.response_deadline != null &&
    new Date(event.response_deadline) < new Date();

  // Closed if: anon RLS filtered the event (closed/draft) OR deadline has passed.
  const isClosed = !event || deadlinePassed;

  if (isClosed) {
    // Read-only view: use event metadata from the RPC (anon RLS can't provide it
    // for non-active events, but SECURITY DEFINER can — see migration 011 rationale).
    return (
      <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
        <EventSummaryHeader
          event={{
            title: response.event_title,
            venue_name: response.event_venue_name,
            event_datetime: response.event_datetime,
            description: response.event_description,
          }}
        />
        <GuestResponseReadOnly response={response} />
      </div>
    );
  }

  // Active + open: fetch menu items, show editable form.
  const { data: menuItems } = await supabase
    .from("menu_items")
    .select("id, name, description, category, sort_order")
    .eq("event_id", event.id)
    .order("sort_order");

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      <EventSummaryHeader event={event} />
      <GuestEditForm
        token={token}
        slug={slug}
        maxPicksPerGuest={event.max_picks_per_guest}
        menuItems={menuItems ?? []}
        initialValues={{
          name: response.guest_name,
          phone: response.guest_phone ?? "",
          menuItemIds: response.pick_ids,
          notes: response.notes ?? "",
        }}
      />
    </div>
  );
}
