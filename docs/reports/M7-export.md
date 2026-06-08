# Milestone 7 — Restaurant Export Page: Completion Report

## Step 0 Findings

| Question | Finding |
|---|---|
| Export folder location | `[id]/export/` existed **outside** `(tabs)`, empty. Created `(tabs)/export/page.tsx`; outer empty folder left (harmless, no page.tsx). |
| `(tabs)` layout guard | Inline: UUID regex → `createClient()` → `.single()` → `22P02` / `!event` → `notFound()`. Wraps `EventDetailHeader` + `TabsNav` + `{children}`. |
| Tally aggregation | `menu_items` ordered by `sort_order` → `responses` (ids) → `response_picks.in(responseIds)`. Count = `counts[menu_item_id]++`. Plates = `Math.ceil(count / 3)`. Category key = `category ?? "Other"` first-seen. Sort within = `b.count - a.count \|\| a.sort_order - b.sort_order`. |
| By-person pattern | `menuItemMap = new Map(id → name)`, `picksByResponse: Map<rid, string[]>`. React JSX default escaping. |
| Datetime formatter | Two inline variants in the codebase (long in `event-details-card`, short in `event-detail-header`). Export uses the **long** format (weekday, month, day, year, time, timezone). |
| Event columns | `venue_name` + `venue_address` both nullable text in `001_init.sql`. `venue_address` was unused in any `.tsx` before this milestone. |

No migration needed — confirmed.

---

## Files Created

| File | Purpose |
|---|---|
| `app/(dashboard)/dashboard/events/[id]/(tabs)/export/page.tsx` | Server component: ownership guard, data fetch + aggregation, passes props to ExportView |
| `components/events/export-view.tsx` | Client component: toggle state, printable artifact, WhatsApp copy button |
| `docs/reports/M7-export.md` | This report |

## Files Modified

| File | Change |
|---|---|
| `components/events/tabs-nav.tsx` | Added Export as 5th tab entry in the `TABS` array |
| `app/(dashboard)/dashboard/events/[id]/(tabs)/layout.tsx` | Wrapped `EventDetailHeader` + `TabsNav` in `<div className="print:hidden">` |
| `app/globals.css` | Added `@media print` block with `@page` margins, black-on-white body, `.print:hidden` enforcement, and `#export-artifact` card-stripping |

---

## How Plate Math and Aggregation Were Reused

The export page replicates the exact same fetch sequence as `tally/page.tsx`:
1. `menu_items` with `sort_order` ordering
2. `responses` (ids only)
3. `response_picks` via `.in(responseIds)`

Count accumulation is byte-for-byte identical:
```ts
pickCounts[pick.menu_item_id] = (pickCounts[pick.menu_item_id] ?? 0) + 1;
```

Plate formula is byte-for-byte identical:
```ts
plates: Math.ceil(count / 3)
```

Category grouping and within-category sort are identical to `TallyView`:
```ts
rows.sort((a, b) => b.count - a.count || a.sort_order - b.sort_order)
```

The only deliberate divergence from Tally: **zero-count dishes are filtered out** on export (`if (count === 0) continue`). Tally shows them for host completeness; the restaurant only needs what was ordered.

---

## Print Isolation Approach

Three layers combine to produce a clean printed page:

1. **Layout wrapper** (`(tabs)/layout.tsx`): `<div className="print:hidden">` hides `EventDetailHeader` and `TabsNav`.
2. **ExportView controls** (`export-view.tsx`): toggle checkbox and Copy button div both carry `print:hidden`.
3. **`@media print` in globals.css**:
   - `@page { margin: 20mm; size: A4; }`
   - `body` forced to white background, black text, 11pt
   - `.print:hidden { display: none !important }` ensures Tailwind utility is enforced even under specificity conflicts
   - `#export-artifact` card background/border/padding stripped for clean paper output

Result: Ctrl/Cmd-P shows only the artifact (title, datetime, venue, response count, order summary, optional per-person appendix).

---

## AC Status

| # | Criterion | Status | How checked |
|---|---|---|---|
| 1 | `/export` renders; Export is 5th tab | ✅ | Code review + build output confirms route |
| 2 | Cross-host → `notFound()` (page-level guard) | ✅ | Code review: page has own guard independent of layout |
| 3 | Header: title, formatted datetime, venue_name + venue_address | ✅ | Code review: both venue columns queried and rendered |
| 4 | Total responses count correct | ✅ | Code review: `responses.length` passed as `responseCount` |
| 5 | Category grouping, count-desc sort, zero-count omitted, ceil(count/3) plates | ✅ | Code review: mirrors Tally verbatim + `if (count === 0) continue` |
| 6 | No "most-wanted" styling | ✅ | Code review: no isMostWanted logic in ExportView |
| 7 | Toggle: per-person appears/disappears in printable + WhatsApp text; no phone | ✅ | Code review: `includePerPerson` state gates both; `guest_phone` never fetched |
| 8 | Copy as WhatsApp: `*bold*`, real newlines, no `#` headers, "Copied!" feedback | ✅ | Code review: `buildWhatsAppText` uses `*…*` syntax, `\n` via array join |
| 9 | Print shows only export artifact, legible on A4 | **Needs browser** | Jes: Ctrl/Cmd-P on the export page |
| 10 | Zero-response event: clean empty state in both surfaces, no NaN | ✅ | Code review: `orderGroups.length === 0` path renders message; `buildWhatsAppText` handles empty array; `Math.ceil(0/3) = 0` never reached since filtered |
| 11 | No new migration; reads ride existing RLS | ✅ | Confirmed: no files in `supabase/migrations/` modified |

`tsc --noEmit`: clean. `next build`: clean (16 routes, 0 errors).

### Fast-follow note
A `wa.me` deep-link button on the share tab (alongside the copy button) would let hosts send the export text directly to the restaurant's WhatsApp number if they have it saved. Not built per spec, but it's a 10-line addition once the host has a "restaurant phone" field.
