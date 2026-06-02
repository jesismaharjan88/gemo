type Props = {
  guestName: string;
  eventTitle: string;
};

export default function ThanksConfirmation({ guestName, eventTitle }: Props) {
  return (
    <div
      className="rounded-[16px] p-8 text-center"
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
        style={{ backgroundColor: "var(--green-light)" }}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: "var(--green)" }}
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <h1
        className="text-3xl mb-2"
        style={{ fontFamily: "var(--font-dm-serif)", color: "var(--text)" }}
      >
        You&apos;re in, {guestName}!
      </h1>
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Your picks for <span className="font-medium" style={{ color: "var(--text)" }}>{eventTitle}</span> have been received.
      </p>
    </div>
  );
}
