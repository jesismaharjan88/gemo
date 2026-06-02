export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminRealtime from "@/components/events/admin-realtime";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export default async function ByPersonPage({
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
      .select("id, title")
      .eq("id", id)
      .single(),
    supabase
      .from("menu_items")
      .select("id, name")
      .eq("event_id", id),
    supabase
      .from("responses")
      .select("id, guest_name, guest_phone, notes, submitted_at, updated_at")
      .eq("event_id", id)
      .order("submitted_at", { ascending: false }),
  ]);

  if (eventResult.error?.code === "22P02") notFound();
  if (!eventResult.data) notFound();

  const menuItems = menuItemsResult.data ?? [];
  const responses = responsesResult.data ?? [];

  const responseIds = responses.map((r) => r.id);
  const picks =
    responseIds.length > 0
      ? (
          await supabase
            .from("response_picks")
            .select("response_id, menu_item_id")
            .in("response_id", responseIds)
        ).data ?? []
      : [];

  // Build map: menu_item_id → name
  const menuItemMap = new Map(menuItems.map((m) => [m.id, m.name]));

  // Build map: response_id → dish names
  const picksByResponse = new Map<string, string[]>();
  for (const pick of picks) {
    const name = menuItemMap.get(pick.menu_item_id);
    if (!name) continue;
    if (!picksByResponse.has(pick.response_id)) picksByResponse.set(pick.response_id, []);
    picksByResponse.get(pick.response_id)!.push(name);
  }

  // Detect possible duplicates: responses sharing the same normalised name
  const nameCount = new Map<string, number>();
  for (const r of responses) {
    const key = r.guest_name.trim().toLowerCase();
    nameCount.set(key, (nameCount.get(key) ?? 0) + 1);
  }
  const isDuplicate = (name: string) =>
    (nameCount.get(name.trim().toLowerCase()) ?? 0) >= 2;

  return (
    <main className="max-w-2xl mx-auto px-4 py-10 space-y-4">
      <AdminRealtime eventId={id} />

      {responses.length === 0 ? (
        <div
          className="rounded-[16px] p-10 text-center"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <p className="text-base font-medium" style={{ color: "var(--text)" }}>
            No responses yet
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            Share the event link to start collecting picks
          </p>
        </div>
      ) : (
        responses.map((r) => {
          const dishes = picksByResponse.get(r.id) ?? [];
          const wasEdited = r.updated_at && r.updated_at > r.submitted_at;
          const possibleDup = isDuplicate(r.guest_name);

          return (
            <div
              key={r.id}
              className="rounded-[16px] p-5 space-y-3"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            >
              {/* Name row + duplicate hint */}
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-base font-medium"
                  style={{ fontFamily: "var(--font-dm-serif)", color: "var(--text)" }}
                >
                  {r.guest_name}
                </span>
                {possibleDup && (
                  <span
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: "var(--surface)",
                      border: "1px solid var(--border-med)",
                      color: "var(--subtle)",
                    }}
                  >
                    possible duplicate
                  </span>
                )}
              </div>

              {/* Phone */}
              {r.guest_phone && (
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  {r.guest_phone}
                </p>
              )}

              {/* Picks */}
              {dishes.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {dishes.map((dish, i) => (
                    <span
                      key={i}
                      className="text-xs px-2.5 py-1 rounded-full"
                      style={{
                        backgroundColor: "var(--bg)",
                        border: "1px solid var(--border-med)",
                        color: "var(--text)",
                      }}
                    >
                      {dish}
                    </span>
                  ))}
                </div>
              )}

              {/* Note */}
              {r.notes && (
                <p
                  className="text-sm leading-relaxed border-l-2 pl-3"
                  style={{ color: "var(--muted)", borderColor: "var(--border-med)" }}
                >
                  {r.notes}
                </p>
              )}

              {/* Timestamp */}
              <p className="text-xs" style={{ color: "var(--subtle)" }}>
                {formatRelative(r.submitted_at)}
                {wasEdited && (
                  <span className="ml-2" style={{ color: "var(--subtle)", opacity: 0.7 }}>
                    · edited {formatRelative(r.updated_at)}
                  </span>
                )}
              </p>
            </div>
          );
        })
      )}
    </main>
  );
}
