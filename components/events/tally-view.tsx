"use client";

import { useState, useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import ExpectedCountEditor from "./expected-count-editor";

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  sort_order: number;
};

type TallyRow = MenuItem & {
  count: number;
  plates: number;
  isMostWanted: boolean;
};

type Props = {
  eventId: string;
  menuItems: MenuItem[];
  initialRespondedCount: number;
  initialPickCounts: Record<string, number>;
  initialExpectedCount: number | null;
};

export default function TallyView({
  eventId,
  menuItems,
  initialRespondedCount,
  initialPickCounts,
  initialExpectedCount,
}: Props) {
  const [respondedCount, setRespondedCount] = useState(initialRespondedCount);
  const [pickCounts, setPickCounts] = useState<Record<string, number>>(initialPickCounts);
  const [expectedCount, setExpectedCount] = useState(initialExpectedCount);

  // Used to filter response_picks events that belong to this event.
  // response_picks has no event_id, but menu_item_id uniquely scopes it:
  // if the menu_item_id is in this event's menu, the pick belongs here.
  const menuItemIds = useRef(new Set(menuItems.map((m) => m.id)));

  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    async function subscribe() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled || !session) return;

      supabase.realtime.setAuth(session.access_token);

      channel = supabase
        .channel(`tally:${eventId}`)
        // ── responses ────────────────────────────────────────────
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "responses",
            filter: `event_id=eq.${eventId}`,
          },
          () => setRespondedCount((c) => c + 1)
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "responses",
            filter: `event_id=eq.${eventId}`,
          },
          () => setRespondedCount((c) => Math.max(0, c - 1))
        )
        // ── response_picks ───────────────────────────────────────
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "response_picks" },
          (payload) => {
            const mid = payload.new.menu_item_id as string;
            if (!menuItemIds.current.has(mid)) return;
            setPickCounts((prev) => ({ ...prev, [mid]: (prev[mid] ?? 0) + 1 }));
          }
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "response_picks" },
          (payload) => {
            const mid = payload.old.menu_item_id as string;
            if (!menuItemIds.current.has(mid)) return;
            setPickCounts((prev) => ({
              ...prev,
              [mid]: Math.max(0, (prev[mid] ?? 0) - 1),
            }));
          }
        )
        .subscribe((status) => {
          console.log("[TallyView] channel status:", status);
        });
    }

    subscribe();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [eventId]);

  // ── Compute tally rows ────────────────────────────────────────────────────
  const allCounts = menuItems.map((m) => pickCounts[m.id] ?? 0);
  const maxCount = allCounts.length > 0 ? Math.max(...allCounts) : 0;

  const tallyRows: TallyRow[] = menuItems.map((m) => {
    const count = pickCounts[m.id] ?? 0;
    return {
      ...m,
      count,
      plates: Math.ceil(count / 3),
      isMostWanted: count > 0 && count === maxCount,
    };
  });

  const categoryOrder: string[] = [];
  const categoryMap = new Map<string, TallyRow[]>();
  for (const row of tallyRows) {
    const cat = row.category ?? "Other";
    if (!categoryMap.has(cat)) {
      categoryMap.set(cat, []);
      categoryOrder.push(cat);
    }
    categoryMap.get(cat)!.push(row);
  }
  for (const rows of categoryMap.values()) {
    rows.sort((a, b) => b.count - a.count || a.sort_order - b.sort_order);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <main className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      {/* Response count + expected-count editor */}
      <div
        className="rounded-[16px] p-6"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p
              className="text-xs font-medium uppercase tracking-wider"
              style={{ color: "var(--subtle)" }}
            >
              Responses
            </p>
            <p
              className="text-2xl mt-1"
              style={{ fontFamily: "var(--font-dm-serif)", color: "var(--text)" }}
            >
              {expectedCount != null
                ? `${respondedCount} of ${expectedCount} responded`
                : `${respondedCount} responded`}
            </p>
          </div>
          <ExpectedCountEditor
            eventId={eventId}
            current={expectedCount}
            onSuccess={setExpectedCount}
          />
        </div>
      </div>

      {/* Zero state */}
      {respondedCount === 0 ? (
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
        categoryOrder.map((cat) => (
          <section key={cat}>
            <h2
              className="text-xs font-semibold uppercase tracking-wider mb-3 px-1"
              style={{ color: "var(--subtle)" }}
            >
              {cat}
            </h2>
            <div className="space-y-2">
              {categoryMap.get(cat)!.map((row) => (
                <div
                  key={row.id}
                  className="rounded-[16px] p-4 flex items-center justify-between gap-4"
                  style={{
                    backgroundColor: "var(--surface)",
                    border: row.isMostWanted
                      ? "1px solid var(--green-border)"
                      : "1px solid var(--border)",
                    borderLeftWidth: row.isMostWanted ? "4px" : "1px",
                    borderLeftColor: row.isMostWanted
                      ? "var(--green-border)"
                      : "var(--border)",
                  }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {row.isMostWanted && (
                      <span
                        className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: "var(--green-light)",
                          color: "var(--green-text)",
                        }}
                      >
                        Most wanted
                      </span>
                    )}
                    <span
                      className="text-sm font-medium truncate"
                      style={{ color: "var(--text)" }}
                    >
                      {row.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <span className="text-sm" style={{ color: "var(--muted)" }}>
                      ~{row.plates} plate{row.plates !== 1 ? "s" : ""}
                    </span>
                    <span
                      className="text-sm font-semibold tabular-nums w-5 text-right"
                      style={{ color: "var(--text)" }}
                    >
                      {row.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </main>
  );
}
