"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type Props = { eventId: string };

/**
 * Mounts a Realtime subscription for admin pages (by-person, etc.).
 * On any INSERT/UPDATE/DELETE to responses or response_picks for this event,
 * calls router.refresh() so the server component re-fetches fresh data.
 * Renders nothing — mount anywhere in the page tree.
 */
export default function AdminRealtime({ eventId }: Props) {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

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
        .channel(`admin-realtime:${eventId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "responses",
            filter: `event_id=eq.${eventId}`,
          },
          () => routerRef.current.refresh()
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "response_picks" },
          () => routerRef.current.refresh()
        )
        .subscribe((status) => {
          console.log("[AdminRealtime] channel status:", status);
        });
    }

    subscribe();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [eventId]);

  return null;
}
