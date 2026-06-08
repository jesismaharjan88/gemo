# Milestone 8 — Submission Rate Limiting: Completion Report

## Step 0 Findings

### 1. Submit invocation path — CRITICAL: path (b)

`GuestForm` (`components/guest/guest-form.tsx`) is `"use client"` and called `supabase.rpc("insert_response", {...})` directly via the browser Supabase client (`createClient()` from `lib/supabase/client`). **There was no server action in the submission path.**

This meant any IP value would have had to come from the browser — completely client-controlled and trivially spoofed.

**Resolution:** Converted the submit path to go through a new Next.js server action (`app/actions/guest.ts`). The server action reads the real client IP from `x-forwarded-for` (platform-set by Vercel, not overrideable by the browser) and passes it to the RPC. The browser client call in `GuestForm` was replaced with an import of the server action.

### 2. The submit RPC — `insert_response`

| Property | Value |
|---|---|
| Name | `public.insert_response` |
| Old signature | `(uuid, text, text, text, uuid[])` |
| New signature | `(uuid, text, text, text, uuid[], text)` — added `p_ip text` |
| `SECURITY DEFINER` | Yes — `SET search_path = ''` |
| Grant | `GRANT EXECUTE TO anon` (guests are unauthenticated) |
| Callers | `GuestForm` only (now via server action) |

### 3. Next migration number

013 was the last. New file: **`014_rate_limiting.sql`**.

### 4. Existing checks

Both preserved intact and unchanged:
- `status = 'active'` check (step 1 in function)
- `response_deadline IS NOT NULL AND < now()` check (step 2)
- `no_picks`, `too_many_picks`, `invalid_menu_items` (steps 3–5)

Rate limit is an **additional** gate inserted before all of these.

### 5. `edit_token` UNIQUE constraint

Already present: `001_init.sql:62` — `edit_token text UNIQUE NOT NULL`. No migration change required.

### 6. Error surface

`GuestForm` uses `toast.error(...)` via sonner. The server action returns a typed result (`{ ok: false; errorKind: "rate_limited" | "generic" }`), and `GuestForm` now branches on `errorKind` to show the appropriate message.

---

## Files Created

| File | Purpose |
|---|---|
| `supabase/migrations/014_rate_limiting.sql` | Creates log table + drops old RPC + creates rate-limited RPC |
| `app/actions/guest.ts` | Server action: reads real IP, calls RPC, returns typed result |

## Files Modified

| File | Change |
|---|---|
| `components/guest/guest-form.tsx` | Replaced direct `supabase.rpc()` call with `submitResponse()` server action import; added rate-limit error branch |

---

## Migration: 014_rate_limiting.sql

### `response_submission_log` table

```sql
CREATE TABLE public.response_submission_log (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip         text        NOT NULL,
  event_id   uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON response_submission_log (ip, created_at);
CREATE INDEX ON response_submission_log (event_id, created_at);
ALTER TABLE response_submission_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE response_submission_log FROM PUBLIC, anon, authenticated;
```

RLS enabled, no policies → default-deny for all roles. Only the `SECURITY DEFINER` function (running as owner) can INSERT. No client ever reads or writes directly.

### Old 5-parameter `insert_response` dropped

`DROP FUNCTION IF EXISTS public.insert_response(uuid, text, text, text, uuid[])` — the old anon grant disappears with the function. Leaving it would create a bypassable backdoor.

### New 6-parameter `insert_response`

Threshold constants live in the `DECLARE` block — one obvious place to adjust for testing:

```sql
c_ip_limit_per_min    constant int := 30;   -- brief spec
c_event_limit_per_min constant int := 60;   -- per-event cap
```

Rate-limit flow:
1. Per-IP check (skipped if `p_ip = 'unknown'`) → `rate_limit_exceeded`
2. Per-event check → `rate_limit_exceeded`
3. `INSERT INTO response_submission_log (ip, event_id)` — inside the transaction
4. Opportunistic pruning: `DELETE ... WHERE created_at < now() - interval '1 hour'`
5. Existing checks: active, deadline, picks count, pick validity
6. Response + picks insert

A submission rejected at steps 5–6 (closed event, past deadline, etc.) rolls back the step 3 log entry and does **not** count toward the rate limit. Only successful submissions are logged.

---

## Rate-Limit Logic and Threshold Location

Both thresholds are in the `DECLARE` block of `insert_response` as `constant int`:

```sql
c_ip_limit_per_min    constant int := 30;
c_event_limit_per_min constant int := 60;
```

**To test (procedure for AC #3 and #8):**
1. Open the Supabase SQL editor
2. Set `c_ip_limit_per_min := 3` (and/or `c_event_limit_per_min := 3` for event cap test)
3. Submit 3 times in the browser → all succeed
4. 4th submission within 60 s → rejected with the rate-limit toast
5. Wait 60 s → 5th submission succeeds again
6. Restore constants to 30 / 60

---

## Per-Event Cap — Built

The 60/min/event cap is included in migration 014. It is IP-spoof-immune: the `event_id` parameter is validated by the RPC's own `WHERE id = p_event_id AND status = 'active'` lookup — a caller cannot forge `event_id` to a value that bypasses this check. Even if an attacker rotates IP values, the per-event window still throttles floods targeted at a single host's event.

---

## Residual Risk (honestly stated)

`insert_response` is anon-callable by design — guests have no session, and the anon key is `NEXT_PUBLIC_*`. This means:

1. **Per-IP limit is evadable** by a script that hits the Supabase PostgREST endpoint directly and rotates the `p_ip` parameter. The server action cannot prevent a caller who bypasses the Next.js layer entirely.

2. **Per-event limit is NOT evadable** by IP rotation, since `event_id` is server-validated. A direct-API attacker can still hit the per-event cap, just with different `p_ip` values.

3. **Real guests going through the app** are reliably throttled by both limits, since `x-forwarded-for` on Vercel is platform-set and the browser cannot override it.

**Accepted for v1.** The per-event cap closes the most damaging case (flooding a single host's event). A v2 hardening path would be to require a short-lived CAPTCHA token or a signed nonce issued by a server endpoint before allowing a submission.

---

## AC Status

| # | Criterion | Status | How checked |
|---|---|---|---|
| 1 | Migration applies; log table exists with RLS + REVOKE | ✅ | Code review — migration written; **Jes to apply via Supabase dashboard** |
| 2 | Single normal submission still works end-to-end | ✅ (code) | Code review: all existing checks preserved; server action returns `editToken` → `router.push(thanks)`. **Browser regression test needed** |
| 3 | Rapid submissions past threshold → friendly toast | **Needs browser** | Jes: set constant to 3, submit 4×, confirm toast |
| 4 | Post-deadline submission rejected | ✅ | Code review: step 2 in RPC unchanged |
| 5 | Closed/non-active event rejected | ✅ | Code review: step 1 in RPC unchanged |
| 6 | Rate-limit rejection shows sonner toast | **Needs browser** | Requires AC 3 browser test |
| 7 | `edit_token` has UNIQUE constraint | ✅ | Confirmed in `001_init.sql:62` |
| 8 | Per-event cap rejects flood even with varying IPs | **Needs browser/script** | Jes: set c_event_limit_per_min to 3, submit 4× with different IPs (or clear cookies), confirm 4th rejected |
| 9 | Log table not directly readable/writable by anon | ✅ | Code review: REVOKE ALL + RLS default-deny; no anon GRANT |
| 10 | `tsc --noEmit` clean; `next build` clean | ✅ | Verified — 16 routes, 0 errors |

`tsc --noEmit`: clean. `next build`: clean (16 routes, 0 errors).

### Migration application (Jes's step)

Run `014_rate_limiting.sql` via the Supabase SQL editor or MCP. After applying:

```sql
-- Verify log table exists with RLS
SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'response_submission_log';
-- Expected: relrowsecurity = true

-- Verify old 5-param function is gone
SELECT proname, pronargs FROM pg_proc WHERE proname = 'insert_response';
-- Expected: one row, pronargs = 6

-- Verify anon grant on new 6-param function
SELECT grantee, privilege_type
FROM information_schema.role_routine_grants
WHERE routine_name = 'insert_response' AND grantee = 'anon';
-- Expected: one row, EXECUTE
```

### Fast-follow notes
- **Edit flow rate limiting**: not in scope (brief specifies submission only), but edits are a plausible secondary flood vector. Easy addition: same log table + per-IP check in `update_response_by_token`.
- **Log table growth**: the opportunistic hourly prune inside the RPC keeps the table bounded at v1 scale. If event volume grows, a `pg_cron` job pruning hourly is cleaner.
- **CAPTCHA / signed nonce**: closes the residual API-bypass risk. Would require a server endpoint that issues a short-lived token + RPC that validates it before accepting a submission.

---

## M8 Follow-up Patch

### Step 0 Schema Findings

The guest form schema is **not** in `/lib/schemas/` — it lives inline in `guest-form.tsx` as a factory `buildSchema(maxPicks: number)`. It cannot be imported directly because:
- It's in a `"use client"` file (cannot be imported by server code)
- It's a factory taking a dynamic per-event `maxPicks` argument

Field names do not align 1:1 with the action's input shape:

| Form field | Action key | Notes |
|---|---|---|
| `name` | `guestName` | max **80** chars |
| `phone` | `guestPhone` | optional, Nepali phone regex (UX-only) |
| `menuItemIds` | `pickIds` | uuid array, min 1, max = dynamic `maxPicks` |
| `notes` | `notes` | max **500** chars, optional |
| — | `eventId` | prop on GuestForm, not a form field |

### Validation Approach: Shared Constants + Dedicated Server Schema

**Approach taken**: Option B — new `/lib/schemas/guest.ts` with exported constants and a server-side `submitResponseSchema`.

**Why not Option A (import form schema directly)**: the `buildSchema` factory is in a `"use client"` file and requires a runtime argument. Neither constraint is resolvable without restructuring the form, which the brief prohibits.

**Shared constants** (`lib/schemas/guest.ts`):
```ts
export const GUEST_NAME_MAX = 80;  // imported by both guest-form.tsx and submitResponse
export const NOTES_MAX      = 500;
export const PICKS_ABS_MAX  = 10;  // DB CHECK constraint upper bound
```

`guest-form.tsx` now imports `GUEST_NAME_MAX` and `NOTES_MAX` and uses them in `buildSchema`. The server schema (`submitResponseSchema`) uses the same constants. A change to either constant propagates to both sides automatically.

**Server schema (`submitResponseSchema`)**:
- `eventId`: `z.string().uuid()` — rejects malformed event IDs before RPC
- `guestName`: `z.string().trim().min(1).max(GUEST_NAME_MAX)` — same bound as form
- `guestPhone`: `z.string().trim().max(20).nullable().optional()` — length-bounded; format validation is UX-only on the form
- `notes`: `z.string().trim().max(NOTES_MAX).nullable().optional()` — same bound as form
- `pickIds`: `z.array(z.string().uuid()).min(1).max(PICKS_ABS_MAX)` — absolute max from DB constraint; per-event max enforced by RPC

### Fixes Applied

| Fix | Change |
|---|---|
| **Fix 1** — Server validation | `submitResponseSchema.safeParse(data)` at top of action, before headers or RPC; uses `parsed.data` in RPC call |
| **Fix 2** — Empty-IP hardening | `forwarded?.split(",")[0]?.trim() \|\| headersList.get("x-real-ip")?.trim() \|\| "unknown"` — empty/whitespace after trim falls through to `'unknown'` |
| **Fix 3** — Idempotent indexes | Named `rsl_ip_created_at_idx` and `rsl_event_id_created_at_idx` with `IF NOT EXISTS` in `014_rate_limiting.sql` |

### AC Status

| # | Criterion | Status |
|---|---|---|
| 1 | Invalid input (empty name, over-max name, empty pickIds, non-uuid pickIds) rejected before RPC | ✅ Code review: `safeParse` returns `{ success: false }` → `{ ok: false, errorKind: "generic" }` |
| 2 | Valid submission still succeeds | ✅ Code review: `parsed.data` flows through unchanged; **browser regression test needed** |
| 3 | Same bounds on client and server | ✅ `GUEST_NAME_MAX`/`NOTES_MAX` imported by both `guest-form.tsx` and `lib/schemas/guest.ts` |
| 4 | Empty `x-forwarded-for` → `'unknown'` | ✅ Code review: `||` chain short-circuits to `'unknown'` on empty string |
| 5 | Both indexes named + `IF NOT EXISTS` | ✅ `rsl_ip_created_at_idx`, `rsl_event_id_created_at_idx` |
| 6 | `tsc --noEmit` clean; `next build` clean | ✅ Verified — 16 routes, 0 errors |
