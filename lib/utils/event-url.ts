/**
 * Constructs the public guest URL for an event.
 * Single source of truth — used by share-link-box, share panel, and anywhere
 * else the /e/[slug] URL is shown or encoded.
 */
export function getGuestUrl(slug: string): string {
  if (typeof window !== "undefined") return `${window.location.origin}/e/${slug}`;
  return `/e/${slug}`;
}
