"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = { eventId: string };

const TABS = [
  { label: "Overview", path: (id: string) => `/dashboard/events/${id}` },
  { label: "Tally", path: (id: string) => `/dashboard/events/${id}/tally` },
  { label: "By person", path: (id: string) => `/dashboard/events/${id}/by-person` },
  { label: "Share", path: (id: string) => `/dashboard/events/${id}/share` },
];

export default function TabsNav({ eventId }: Props) {
  const pathname = usePathname();

  return (
    <div
      className="border-b px-4"
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
    >
      <nav className="max-w-2xl mx-auto flex gap-1">
        {TABS.map(({ label, path }) => {
          const href = path(eventId);
          const isActive = pathname === href;
          return (
            <Link
              key={label}
              href={href}
              className="text-sm font-medium px-3 py-3 border-b-2 transition-colors"
              style={{
                borderColor: isActive ? "var(--green)" : "transparent",
                color: isActive ? "var(--green-text)" : "var(--muted)",
              }}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
