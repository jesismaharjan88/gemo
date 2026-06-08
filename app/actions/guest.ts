"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { submitResponseSchema } from "@/lib/schemas/guest";

export type SubmitResponseResult =
  | { ok: true; editToken: string }
  | { ok: false; errorKind: "rate_limited" | "generic" };

/**
 * Server action for guest response submission.
 *
 * Routing through a server action (vs. direct browser RPC call) lets us read
 * the real client IP from platform-set headers (x-forwarded-for on Vercel)
 * before passing it to the rate-limited insert_response RPC.
 *
 * Fail-open IP: if the IP header is absent or empty we pass 'unknown' so a
 * real guest isn't locked out over a missing header. The per-event cap in the
 * RPC still provides spoof-immune protection in that case.
 */
export async function submitResponse(data: {
  eventId: string;
  guestName: string;
  guestPhone: string | null;
  notes: string | null;
  pickIds: string[];
}): Promise<SubmitResponseResult> {
  // Validate before touching headers or calling the RPC.
  // Server actions are public endpoints — a hand-crafted call can send anything.
  const parsed = submitResponseSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, errorKind: "generic" };
  }

  const headersList = await headers();

  // x-forwarded-for is a comma-separated list; the first entry is the client IP.
  // On Vercel, this header is platform-set and cannot be injected by the browser.
  // Treat empty-after-trim as 'unknown' so it routes through the fail-open path
  // rather than sharing one real rate-limit bucket with other empty-string IPs.
  const forwarded = headersList.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    headersList.get("x-real-ip")?.trim() ||
    "unknown";

  // createClient() falls back to anon role when there is no auth session,
  // which is the correct context for unauthenticated guest submissions.
  const supabase = await createClient();

  const { data: result, error } = await supabase.rpc("insert_response", {
    p_event_id:    parsed.data.eventId,
    p_guest_name:  parsed.data.guestName,
    p_guest_phone: parsed.data.guestPhone ?? null,
    p_notes:       parsed.data.notes ?? null,
    p_pick_ids:    parsed.data.pickIds,
    p_ip:          ip,
  });

  if (error) {
    const isRateLimit = error.message.includes("rate_limit_exceeded");
    return { ok: false, errorKind: isRateLimit ? "rate_limited" : "generic" };
  }

  const { edit_token } = result as { id: string; edit_token: string };
  return { ok: true, editToken: edit_token };
}
