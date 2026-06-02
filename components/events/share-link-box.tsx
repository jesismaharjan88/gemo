"use client";

import { useRef } from "react";
import { toast } from "sonner";
import { getGuestUrl } from "@/lib/utils/event-url";

type Props = { slug: string };

export default function ShareLinkBox({ slug }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleCopy() {
    const url = getGuestUrl(slug);
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Link copied to clipboard");
    }).catch(() => {
      inputRef.current?.select();
      toast.error("Couldn't copy — select the link manually");
    });
  }

  const url = getGuestUrl(slug);

  return (
    <div
      className="rounded-[16px] p-6 space-y-3"
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <h2 className="text-base font-medium" style={{ color: "var(--text)" }}>
        Guest link
      </h2>
      <p className="text-xs" style={{ color: "var(--muted)" }}>
        Share this link with your guests so they can submit their menu picks.
      </p>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          readOnly
          value={url}
          className="flex-1 px-3 py-2 rounded-[10px] text-sm font-mono outline-none border"
          style={{
            backgroundColor: "var(--bg)",
            borderColor: "var(--border-med)",
            color: "var(--text)",
          }}
          onFocus={(e) => e.currentTarget.select()}
        />
        <button
          type="button"
          onClick={handleCopy}
          className="px-4 py-2 rounded-[10px] text-sm font-medium text-white flex-shrink-0 transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--green)" }}
        >
          Copy
        </button>
      </div>
    </div>
  );
}
