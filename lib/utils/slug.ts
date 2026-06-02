import slugify from "slugify";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("23456789abcdefghjkmnpqrstuvwxyz", 6);

export function generateSlug(title: string): string {
  const base = slugify(title, { lower: true, strict: true }).slice(0, 73);
  const suffix = nanoid();
  const slug = base ? `${base}-${suffix}` : `event-${suffix}`;
  // Guard: slug must match ^[a-z0-9-]+$ and be 3-80 chars (DB CHECK from 004)
  if (!/^[a-z0-9-]+$/.test(slug) || slug.length < 3 || slug.length > 80) {
    return `event-${nanoid()}`;
  }
  return slug;
}
