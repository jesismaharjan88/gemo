import { APP_NAME } from "@/lib/constants";

export default function GuestNotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ backgroundColor: "var(--bg)" }}>
      <div
        className="w-full max-w-sm rounded-[16px] p-8 text-center"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <p
          className="text-xl mb-4"
          style={{ fontFamily: "var(--font-dm-serif)", color: "var(--text)" }}
        >
          {APP_NAME}
        </p>
        <h1
          className="text-2xl mb-3"
          style={{ fontFamily: "var(--font-dm-serif)", color: "var(--text)" }}
        >
          Link not available
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
          This event link isn&apos;t available. Double-check the URL or ask the host for the correct link.
        </p>
      </div>
    </div>
  );
}
