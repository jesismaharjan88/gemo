export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ExportView from "@/components/events/export-view";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatDatetime(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default async function ExportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();

  // Page-level ownership guard — does not trust the layout.
  const [eventResult, menuItemsResult, responsesResult] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, venue_name, venue_address, event_datetime")
      .eq("id", id)
      .single(),
    supabase
      .from("menu_items")
      .select("id, name, category, sort_order")
      .eq("event_id", id)
      .order("sort_order"),
    supabase
      .from("responses")
      .select("id, guest_name, notes")
      .eq("event_id", id),
  ]);

  if (eventResult.error?.code === "22P02") notFound();
  if (!eventResult.data) notFound();

  const event = eventResult.data;
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

  // ── Aggregate pick counts (mirrors Tally exactly) ─────────────────────────
  const pickCounts: Record<string, number> = {};
  for (const pick of picks) {
    pickCounts[pick.menu_item_id] = (pickCounts[pick.menu_item_id] ?? 0) + 1;
  }

  // Build category groups — same category ?? "Other" + first-seen order as Tally.
  // Filter zero-count dishes (restaurant only needs what was ordered).
  const categoryOrder: string[] = [];
  const categoryMap = new Map<
    string,
    Array<{ name: string; count: number; plates: number }>
  >();

  for (const item of menuItems) {
    const count = pickCounts[item.id] ?? 0;
    if (count === 0) continue; // export omits zero-count dishes

    const cat = item.category ?? "Other";
    if (!categoryMap.has(cat)) {
      categoryMap.set(cat, []);
      categoryOrder.push(cat);
    }
    categoryMap.get(cat)!.push({
      name: item.name,
      count,
      plates: Math.ceil(count / 3), // plate formula identical to Tally
    });
  }

  // Sort within each category: count desc, then sort_order asc (same as Tally)
  for (const [cat, items] of categoryMap) {
    const withOrder = items.map((item) => ({
      ...item,
      sort_order:
        menuItems.find((m) => m.name === item.name && (m.category ?? "Other") === cat)
          ?.sort_order ?? 0,
    }));
    withOrder.sort((a, b) => b.count - a.count || a.sort_order - b.sort_order);
    categoryMap.set(
      cat,
      withOrder.map(({ sort_order: _so, ...rest }) => rest)
    );
  }

  const orderGroups = categoryOrder.map((cat) => ({
    category: cat,
    items: categoryMap.get(cat)!,
  }));

  // ── Per-person list (no phone — restaurant doesn't need it) ───────────────
  const menuItemMap = new Map(menuItems.map((m) => [m.id, m.name]));
  const picksByResponse = new Map<string, string[]>();
  for (const pick of picks) {
    const name = menuItemMap.get(pick.menu_item_id);
    if (!name) continue;
    if (!picksByResponse.has(pick.response_id)) picksByResponse.set(pick.response_id, []);
    picksByResponse.get(pick.response_id)!.push(name);
  }

  const perPerson = responses.map((r) => ({
    id: r.id,
    guestName: r.guest_name,
    dishes: picksByResponse.get(r.id) ?? [],
    notes: r.notes,
  }));

  return (
    <ExportView
      event={{
        title: event.title,
        formattedDatetime: event.event_datetime
          ? formatDatetime(event.event_datetime)
          : null,
        venueName: event.venue_name,
        venueAddress: event.venue_address,
      }}
      responseCount={responses.length}
      orderGroups={orderGroups}
      perPerson={perPerson}
    />
  );
}
