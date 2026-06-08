import { z } from "zod";

// Shared constraint constants — single source of truth for client (guest-form)
// and server (submitResponse action). Update here; both sides stay in sync.
export const GUEST_NAME_MAX = 80;
export const NOTES_MAX = 500;
// Absolute upper bound on picks — matches the DB CHECK on max_picks_per_guest.
// The per-event max is enforced by the RPC against the actual event row.
export const PICKS_ABS_MAX = 10;

/**
 * Server-side validation schema for the submitResponse action.
 * Keys match the action's argument shape, not the form's field names.
 * Phone format (Nepali regex) is a UX constraint enforced client-side only;
 * the server accepts any reasonable string or null.
 */
export const submitResponseSchema = z.object({
  eventId:    z.string().uuid(),
  guestName:  z.string().trim().min(1).max(GUEST_NAME_MAX),
  guestPhone: z.string().trim().max(20).nullable().optional(),
  notes:      z.string().trim().max(NOTES_MAX).nullable().optional(),
  pickIds:    z.array(z.string().uuid()).min(1).max(PICKS_ABS_MAX),
});
