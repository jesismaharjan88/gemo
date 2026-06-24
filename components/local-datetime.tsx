"use client";

// Renders a UTC ISO string in the viewer's local browser timezone.
// Must be a client component — Intl.DateTimeFormat(undefined) on the server
// resolves to the Node process timezone (UTC), not the user's timezone.

const DEFAULT_OPTIONS: Intl.DateTimeFormatOptions = {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
};

type Props = {
  iso: string;
  options?: Intl.DateTimeFormatOptions;
};

export default function LocalDateTime({ iso, options }: Props) {
  let formatted: string;
  try {
    formatted = new Intl.DateTimeFormat(undefined, options ?? DEFAULT_OPTIONS).format(new Date(iso));
  } catch {
    formatted = iso;
  }
  // suppressHydrationWarning: the server renders in UTC, the browser renders in
  // the viewer's local timezone — the mismatch is intentional and harmless.
  return <time dateTime={iso} suppressHydrationWarning>{formatted}</time>;
}
