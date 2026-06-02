import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

export default function EventNotFound() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      <header
        className="border-b px-6 py-4"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <span
          className="text-xl"
          style={{ fontFamily: "var(--font-dm-serif)", color: "var(--text)" }}
        >
          {APP_NAME}
        </span>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-20 text-center">
        <h1
          className="text-3xl mb-3"
          style={{ fontFamily: "var(--font-dm-serif)", color: "var(--text)" }}
        >
          Event not found
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--muted)" }}>
          This event doesn&apos;t exist or you don&apos;t have access to it.
        </p>
        <Link
          href="/dashboard"
          className="px-5 py-2.5 rounded-[10px] text-sm font-medium text-white"
          style={{ backgroundColor: "var(--green)" }}
        >
          Back to dashboard
        </Link>
      </main>
    </div>
  );
}
