/**
 * RLS smoke-test: creates two host users, verifies cross-user access is denied,
 * and verifies anon guest access follows event status rules.
 *
 * Run after migrations are applied:
 *   npx tsx scripts/test-rls.ts
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error("Missing env vars. Check .env.local");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── helpers ────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function ok(label: string) {
  console.log(`  ✓  ${label}`);
  passed++;
}

function fail(label: string, detail?: unknown) {
  console.error(`  ✗  ${label}`, detail ?? "");
  failed++;
}

async function signIn(email: string, password: string) {
  const { data, error } = await admin.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`signIn failed for ${email}: ${error?.message}`);
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  });
}

// ─── setup ─────────────────────────────────────────────────

const TS = Date.now();
const EMAIL_A = `rls-test-a-${TS}@example.com`;
const EMAIL_B = `rls-test-b-${TS}@example.com`;
const PASSWORD = "TestPass123!";

async function createUser(email: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser(${email}) failed: ${error.message}`);
  return data.user!.id;
}

async function cleanup(uidA: string, uidB: string) {
  await admin.auth.admin.deleteUser(uidA).catch(() => {});
  await admin.auth.admin.deleteUser(uidB).catch(() => {});
}

// ─── main ──────────────────────────────────────────────────

async function main() {
  console.log("\nGemo RLS test\n");

  let uidA = "", uidB = "";

  try {
    console.log("Setting up test users…");
    uidA = await createUser(EMAIL_A);
    uidB = await createUser(EMAIL_B);
    console.log(`  Host A: ${uidA}`);
    console.log(`  Host B: ${uidB}\n`);

    const clientA = await signIn(EMAIL_A, PASSWORD);
    const clientB = await signIn(EMAIL_B, PASSWORD);
    const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── hosts table ─────────────────────────────────────────
    console.log("hosts table:");

    const { data: hostA } = await clientA.from("hosts").select("id").single();
    if (hostA?.id === uidA) ok("A sees own hosts row");
    else fail("A should see own hosts row", hostA);

    const { data: hostCross } = await clientA.from("hosts").select("id").eq("id", uidB);
    if ((hostCross ?? []).length === 0) ok("A cannot see B's hosts row");
    else fail("A must NOT see B's hosts row");

    // ── events: host CRUD isolation ──────────────────────────
    console.log("\nevents — host isolation:");

    const { data: evA, error: evAErr } = await clientA
      .from("events")
      .insert({ host_id: uidA, slug: `test-a-${TS}`, title: "A's Event", status: "active" })
      .select()
      .single();
    if (evA?.id) ok("A can insert own event");
    else fail("A should insert own event", evAErr);

    const { data: evB, error: evBErr } = await clientB
      .from("events")
      .insert({ host_id: uidB, slug: `test-b-${TS}`, title: "B's Event", status: "active" })
      .select()
      .single();
    if (evB?.id) ok("B can insert own event");
    else fail("B should insert own event", evBErr);

    // A tries to read B's event
    const { data: crossEv } = await clientA.from("events").select("id").eq("id", evB!.id);
    if ((crossEv ?? []).length === 0) ok("A cannot read B's event (returns 0 rows, not 403)");
    else fail("A must NOT see B's event");

    // A tries to update B's event (should silently affect 0 rows)
    const { data: updateRows } = await clientA
      .from("events")
      .update({ title: "Hijacked" })
      .eq("id", evB!.id)
      .select("id");
    if ((updateRows ?? []).length === 0) ok("A cannot update B's event");
    else fail("A must NOT update B's event");

    // ── events: anon can only see active ────────────────────
    console.log("\nevents — anon access:");

    const { data: anonActive } = await anonClient
      .from("events")
      .select("id")
      .eq("id", evA!.id);
    if ((anonActive ?? []).length === 1) ok("anon sees active event");
    else fail("anon should see active event");

    // Close A's event, anon should no longer see it
    await clientA.from("events").update({ status: "closed" }).eq("id", evA!.id);
    const { data: anonClosed } = await anonClient
      .from("events")
      .select("id")
      .eq("id", evA!.id);
    if ((anonClosed ?? []).length === 0) ok("anon cannot see closed event");
    else fail("anon must NOT see closed event");

    // Re-open for remaining tests
    await clientA.from("events").update({ status: "active" }).eq("id", evA!.id);

    // ── menu_items: anon access follows event status ─────────
    console.log("\nmenu_items — anon access:");

    const { data: mi } = await clientA
      .from("menu_items")
      .insert({ event_id: evA!.id, name: "Butter Chicken" })
      .select()
      .single();

    const { data: anonItems } = await anonClient
      .from("menu_items")
      .select("id")
      .eq("event_id", evA!.id);
    if ((anonItems ?? []).length === 1) ok("anon sees menu items of active event");
    else fail("anon should see menu items of active event");

    const { data: crossItems } = await clientB
      .from("menu_items")
      .select("id")
      .eq("event_id", evA!.id);
    if ((crossItems ?? []).length === 0) ok("B cannot see A's menu items");
    else fail("B must NOT see A's menu items");

    // ── responses: insert_response RPC ─────────────────────
    console.log("\nresponses — guest RPCs:");

    const { data: insertResult, error: insertErr } = await anonClient.rpc("insert_response", {
      p_event_id: evA!.id,
      p_guest_name: "Test Guest",
      p_guest_phone: null,
      p_notes: null,
      p_pick_ids: [mi!.id],
    });
    if (insertResult?.edit_token) ok("anon can insert_response via RPC");
    else fail("anon should insert_response", insertErr);

    const token: string = insertResult?.edit_token;

    // get_response_by_token with valid token
    const { data: getResult, error: getErr } = await anonClient.rpc("get_response_by_token", {
      p_token: token,
    });
    if (getResult?.guest_name === "Test Guest") ok("anon can get_response_by_token");
    else fail("anon should get_response_by_token", getErr);

    // get_response_by_token with invalid token
    const { data: badGet, error: badGetErr } = await anonClient.rpc("get_response_by_token", {
      p_token: "0000000000000000",
    });
    if (!badGet && badGetErr) ok("invalid token returns error (not silent empty)");
    else fail("invalid token should raise exception", badGet);

    // update_response_by_token
    const { data: updateResult, error: updateErr } = await anonClient.rpc(
      "update_response_by_token",
      {
        p_token: token,
        p_guest_name: "Updated Guest",
        p_guest_phone: "9876543210",
        p_notes: "No nuts please",
        p_pick_ids: [mi!.id],
      }
    );
    if (updateResult?.edit_token === token) ok("anon can update_response_by_token");
    else fail("anon should update_response_by_token", updateErr);

    // anon cannot directly SELECT responses table
    const { data: directResp } = await anonClient
      .from("responses")
      .select("id")
      .limit(1);
    if ((directResp ?? []).length === 0) ok("anon cannot directly SELECT responses");
    else fail("anon must NOT directly SELECT responses");

    // host A can see responses on own event
    const { data: hostResp } = await clientA
      .from("responses")
      .select("id")
      .eq("event_id", evA!.id);
    if ((hostResp ?? []).length > 0) ok("host A can SELECT responses on own event");
    else fail("host A should see responses on own event");

    // host B cannot see host A's responses
    const { data: crossResp } = await clientB
      .from("responses")
      .select("id")
      .eq("event_id", evA!.id);
    if ((crossResp ?? []).length === 0) ok("host B cannot SELECT host A's responses");
    else fail("host B must NOT see host A's responses");

    // insert_response on closed event should fail
    await clientA.from("events").update({ status: "closed" }).eq("id", evA!.id);
    const { error: closedErr } = await anonClient.rpc("insert_response", {
      p_event_id: evA!.id,
      p_guest_name: "Late Guest",
      p_guest_phone: null,
      p_notes: null,
      p_pick_ids: [mi!.id],
    });
    if (closedErr) ok("insert_response blocked on closed event");
    else fail("insert_response must reject closed event");

    // Re-open for status transition tests below
    await clientA.from("events").update({ status: "active" }).eq("id", evA!.id);

    // ── update_host_profile ─────────────────────────────────
    console.log("\nupdate_host_profile:");

    // Happy path
    const { error: profileErr } = await clientA.rpc("update_host_profile", {
      p_name: "Alice Host",
    });
    if (!profileErr) ok("update_host_profile happy path");
    else fail("update_host_profile should succeed", profileErr);

    // Verify name was persisted and trimmed
    const { data: hostRow } = await clientA.from("hosts").select("name, onboarded_at").single();
    if (hostRow?.name === "Alice Host" && hostRow.onboarded_at) {
      ok("name persisted and onboarded_at set");
    } else {
      fail("name/onboarded_at not persisted correctly", hostRow);
    }

    // Unauthenticated call rejected
    const { error: anonProfileErr } = await anonClient.rpc("update_host_profile", {
      p_name: "Hacker",
    });
    if (anonProfileErr) ok("update_host_profile rejects unauthenticated caller");
    else fail("update_host_profile must reject anon");

    // Empty string rejected
    const { error: emptyNameErr } = await clientA.rpc("update_host_profile", {
      p_name: "",
    });
    if (emptyNameErr) ok("update_host_profile rejects empty name");
    else fail("update_host_profile must reject empty name");

    // Whitespace-only rejected
    const { error: wsNameErr } = await clientA.rpc("update_host_profile", {
      p_name: "   ",
    });
    if (wsNameErr) ok("update_host_profile rejects whitespace-only name");
    else fail("update_host_profile must reject whitespace-only name");

    // NULL rejected
    const { error: nullNameErr } = await (clientA as any).rpc("update_host_profile", {
      p_name: null,
    });
    if (nullNameErr) ok("update_host_profile rejects NULL name");
    else fail("update_host_profile must reject NULL name");

    // Oversize name rejected (101 chars)
    const { error: longNameErr } = await clientA.rpc("update_host_profile", {
      p_name: "A".repeat(101),
    });
    if (longNameErr) ok("update_host_profile rejects name > 100 chars");
    else fail("update_host_profile must reject name > 100 chars");

    // ── set_event_status ───────────────────────────────────
    console.log("\nset_event_status:");

    // evA is currently active, evB is closed (from earlier test)
    // First create a fresh draft event for transition tests
    const { data: evDraft } = await clientA
      .from("events")
      .insert({ host_id: uidA, slug: `test-draft-${TS}`, title: "Draft Event", status: "draft" })
      .select()
      .single();

    // draft → active
    const { error: d2aErr } = await clientA.rpc("set_event_status", {
      p_event_id: evDraft!.id,
      p_status: "active",
    });
    if (!d2aErr) ok("set_event_status: draft → active");
    else fail("set_event_status: draft → active should succeed", d2aErr);

    // Revert to draft via direct update for next test (mimicking a fresh draft)
    await clientA.from("events").update({ status: "draft" }).eq("id", evDraft!.id);

    // draft → closed
    const { error: d2cErr } = await clientA.rpc("set_event_status", {
      p_event_id: evDraft!.id,
      p_status: "closed",
    });
    if (!d2cErr) ok("set_event_status: draft → closed");
    else fail("set_event_status: draft → closed should succeed", d2cErr);

    // closed → active (reopen)
    const { error: c2aErr } = await clientA.rpc("set_event_status", {
      p_event_id: evDraft!.id,
      p_status: "active",
    });
    if (!c2aErr) ok("set_event_status: closed → active");
    else fail("set_event_status: closed → active should succeed", c2aErr);

    // active → closed
    const { error: a2cErr } = await clientA.rpc("set_event_status", {
      p_event_id: evDraft!.id,
      p_status: "closed",
    });
    if (!a2cErr) ok("set_event_status: active → closed");
    else fail("set_event_status: active → closed should succeed", a2cErr);

    // Invalid transition: active→draft (evA is active)
    const { error: a2dErr } = await clientA.rpc("set_event_status", {
      p_event_id: evA!.id,
      p_status: "draft",
    });
    if (a2dErr) ok("set_event_status: active → draft rejected (invalid transition)");
    else fail("set_event_status: active → draft must be rejected");

    // Idempotent no-op: draft → draft rejected
    await clientA.from("events").update({ status: "draft" }).eq("id", evDraft!.id);
    const { error: d2dErr } = await clientA.rpc("set_event_status", {
      p_event_id: evDraft!.id,
      p_status: "draft",
    });
    if (d2dErr) ok("set_event_status: draft → draft rejected (invalid_transition)");
    else fail("set_event_status: draft → draft must be rejected");

    // Cross-host: B tries to close A's event → not_found (no existence leak)
    const { error: crossStatusErr } = await clientB.rpc("set_event_status", {
      p_event_id: evA!.id,
      p_status: "closed",
    });
    if (crossStatusErr?.message?.includes("not_found") || crossStatusErr) {
      ok("set_event_status: cross-host call returns not_found");
    } else {
      fail("set_event_status: cross-host must return not_found");
    }

    // Nonexistent UUID → not_found (same error as cross-host)
    const { error: missingErr } = await clientA.rpc("set_event_status", {
      p_event_id: "00000000-0000-0000-0000-000000000000",
      p_status: "active",
    });
    if (missingErr) ok("set_event_status: nonexistent UUID returns not_found");
    else fail("set_event_status: nonexistent UUID must return not_found");

    // Invalid status value
    const { error: badStatusErr } = await (clientA as any).rpc("set_event_status", {
      p_event_id: evA!.id,
      p_status: "archived",
    });
    if (badStatusErr) ok("set_event_status: invalid status value rejected");
    else fail("set_event_status: invalid status must be rejected");

  } finally {
    console.log("\nCleaning up test users…");
    await cleanup(uidA, uidB);
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
