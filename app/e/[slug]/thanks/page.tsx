import { createClient } from "@/lib/supabase/server";
import ThanksConfirmation from "@/components/guest/thanks-confirmation";
import OrderSummary from "@/components/guest/order-summary";
import EditLinkBox from "@/components/guest/edit-link-box";
import { APP_NAME } from "@/lib/constants";

const SLUG_RE = /^[a-z0-9-]{3,80}$/;

function Fallback() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ backgroundColor: "var(--bg)" }}>
      <div
        className="w-full max-w-sm rounded-[16px] p-8 text-center"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <p className="text-sm font-medium mb-4" style={{ color: "var(--green)" }}>
          {APP_NAME}
        </p>
        <h1
          className="text-xl mb-3"
          style={{ fontFamily: "var(--font-dm-serif)", color: "var(--text)" }}
        >
          Looks like you got here directly
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
          If you&apos;ve already submitted a response, check the link the form gave you after submitting. If you think something went wrong, contact the host.
        </p>
      </div>
    </div>
  );
}

export default async function ThanksPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { slug } = await params;
  const { t } = await searchParams;

  if (!SLUG_RE.test(slug)) return <Fallback />;

  // No token → gentle fallback, not a 404.
  if (!t) return <Fallback />;

  const supabase = await createClient();

  // Look up event by slug (anon RLS: active events only).
  const { data: event } = await supabase
    .from("events")
    .select("id, title, slug")
    .eq("slug", slug)
    .single();

  // No event found (doesn't exist, draft, or closed) → fallback.
  if (!event) return <Fallback />;

  // Resolve token via RPC (anon-callable).
  const { data: tokenData, error: tokenError } = await supabase.rpc(
    "get_response_by_token",
    { p_token: t }
  );

  // Token doesn't resolve → fallback, no leak.
  if (tokenError || !tokenData) return <Fallback />;

  const response = tokenData as {
    id: string;
    event_id: string;
    guest_name: string;
    guest_phone: string | null;
    notes: string | null;
    pick_ids: string[];
    submitted_at: string;
  };

  // Cross-event leak check: token must belong to THIS event.
  if (response.event_id !== event.id) return <Fallback />;

  // Look up dish names for the pick_ids (follow-up query — RPC only returns UUIDs).
  const { data: menuItems } = await supabase
    .from("menu_items")
    .select("id, name")
    .in("id", response.pick_ids);

  // Build an ordered list matching the pick_ids order.
  const pickNames: string[] = response.pick_ids
    .map((id) => menuItems?.find((m) => m.id === id)?.name)
    .filter((n): n is string => Boolean(n));

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      <main className="max-w-xl mx-auto px-4 py-10 space-y-6">
        <ThanksConfirmation guestName={response.guest_name} eventTitle={event.title} />
        <OrderSummary pickNames={pickNames} notes={response.notes} />
        <EditLinkBox slug={slug} token={t} />
      </main>
    </div>
  );
}
