"use client";

// Shows the viewer's current IANA timezone and UTC offset, e.g. "Asia/Kathmandu (UTC+5:45)".
// Used on the event form so hosts know which timezone their date/time inputs are anchored to.

function getOffsetLabel(tz: string): string {
  try {
    // Use a fixed reference date to read the offset string
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date());
    const offset = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    return offset;
  } catch {
    return "";
  }
}

export default function TimezoneHint() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const offset = getOffsetLabel(tz);
  return (
    <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
      Times are in your local timezone:{" "}
      <span style={{ color: "var(--text)" }}>
        {tz}{offset ? ` (${offset})` : ""}
      </span>
    </p>
  );
}
