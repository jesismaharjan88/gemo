import Link from "next/link";

export default function EmptyDashboardState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <h2
        className="text-3xl mb-3"
        style={{ fontFamily: "var(--font-dm-serif)", color: "var(--text)" }}
      >
        Welcome to GEMO
      </h2>
      <p className="text-sm mb-8 max-w-sm" style={{ color: "var(--muted)" }}>
        Create your first event to start collecting menu choices from guests.
      </p>
      <Link
        href="/dashboard/events/new"
        className="px-6 py-2.5 rounded-[10px] text-sm font-medium text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: "var(--green)" }}
      >
        Create your first event
      </Link>
    </div>
  );
}
