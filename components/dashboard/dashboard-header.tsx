import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { APP_NAME } from "@/lib/constants";

export default function DashboardHeader({
  hostName,
  hostEmail,
}: {
  hostName: string;
  hostEmail: string;
}) {
  return (
    <>
      <header
        className="border-b px-6 py-4 flex items-center justify-between"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <span
          className="text-xl"
          style={{ fontFamily: "var(--font-dm-serif)", color: "var(--text)" }}
        >
          {APP_NAME}
        </span>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/events/new"
            className="px-4 py-2 rounded-[10px] text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--green)" }}
          >
            Create event
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="text-sm font-medium px-4 py-2 rounded-[10px]"
              style={{ color: "var(--muted)" }}
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 pt-10 pb-2">
        <h1
          className="text-3xl mb-1"
          style={{ fontFamily: "var(--font-dm-serif)", color: "var(--text)" }}
        >
          Welcome{hostName ? `, ${hostName}` : ""}
        </h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          {hostEmail}
        </p>
      </div>
    </>
  );
}
