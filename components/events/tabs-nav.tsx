"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = { eventId: string };

const TABS = [
  { label: "Overview", path: (id: string) => `/dashboard/events/${id}` },
  { label: "Tally", path: (id: string) => `/dashboard/events/${id}/tally` },
  { label: "By person", path: (id: string) => `/dashboard/events/${id}/by-person` },
  { label: "Share", path: (id: string) => `/dashboard/events/${id}/share` },
  { label: "Export", path: (id: string) => `/dashboard/events/${id}/export` },
];

export default function TabsNav({ eventId }: Props) {
  const pathname = usePathname();

  return (
    <div
      className="border-b no-scrollbar"
      style={{
        backgroundColor: "var(--surface)",
        borderColor: "var(--border)",
        overflowX: "auto",
        WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"],
      }}
    >
      <nav className="max-w-2xl mx-auto flex gap-1 px-4" style={{ minWidth: "max-content" }}>
        {TABS.map(({ label, path }) => {
          const href = path(eventId);
          const isActive = pathname === href;
          return (
            <Link
              key={label}
              href={href}
              className="text-sm font-medium px-3 py-3 border-b-2 transition-colors whitespace-nowrap"
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
