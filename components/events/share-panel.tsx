"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { getGuestUrl } from "@/lib/utils/event-url";

type Props = {
  slug: string;
  title: string;
};

export default function SharePanel({ slug, title }: Props) {
  const url = getGuestUrl(slug);

  // Display QR as a data URL rendered into an <img> — avoids all canvas sizing quirks
  const [qrSrc, setQrSrc] = useState<string>("");

  useEffect(() => {
    const guestUrl = `${window.location.origin}/e/${slug}`;
    QRCode.toDataURL(guestUrl, {
      width: 512,
      margin: 2,
      color: { dark: "#1a1a1a", light: "#ffffff" },
    }).then(setQrSrc);
  }, [slug]);

  function handleCopy() {
    const guestUrl = `${window.location.origin}/e/${slug}`;
    navigator.clipboard.writeText(guestUrl).then(() => {
      toast.success("Link copied to clipboard");
    }).catch(() => {
      toast.error("Couldn't copy automatically — copy the link manually");
    });
  }

  function handleWhatsApp() {
    const guestUrl = `${window.location.origin}/e/${slug}`;
    const text = `Help me plan the menu for ${title}! Pick your dishes here: ${guestUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  async function handleDownloadQR() {
    const guestUrl = `${window.location.origin}/e/${slug}`;
    // Generate at 2× resolution for a crisp print-quality PNG
    const dataUrl = await QRCode.toDataURL(guestUrl, {
      width: 1024,
      margin: 2,
      color: { dark: "#1a1a1a", light: "#ffffff" },
    });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `gemo-${slug}-qr.png`;
    a.click();
  }

  return (
    <div className="space-y-4">
      {/* Copy link */}
      <div
        className="rounded-[16px] p-6 space-y-3"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <h2 className="text-base font-medium" style={{ color: "var(--text)" }}>
          Guest link
        </h2>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          Share this link so guests can submit their menu picks.
        </p>
        <div className="flex gap-2">
          <input
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

        {/* WhatsApp */}
        <button
          type="button"
          onClick={handleWhatsApp}
          className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-[10px] w-full justify-center font-medium transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#25D366", color: "#fff" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          Share via WhatsApp
        </button>
      </div>

      {/* QR code */}
      <div
        className="rounded-[16px] p-6 space-y-4"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div>
          <h2 className="text-base font-medium" style={{ color: "var(--text)" }}>
            QR code
          </h2>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            Print for table cards or display at the venue.
          </p>
        </div>

        {/* Placeholder keeps the space while the data URL generates (near-instant) */}
        {qrSrc ? (
          <img
            src={qrSrc}
            alt="QR code"
            style={{
              display: "block",
              width: "100%",
              maxWidth: "220px",
              height: "auto",
              margin: "0 auto",
              borderRadius: "8px",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              maxWidth: "220px",
              aspectRatio: "1 / 1",
              margin: "0 auto",
              borderRadius: "8px",
              backgroundColor: "var(--bg)",
            }}
          />
        )}

        <button
          type="button"
          onClick={handleDownloadQR}
          className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-[10px] w-full justify-center border transition-colors hover:opacity-80"
          style={{ borderColor: "var(--border-med)", color: "var(--muted)" }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M7 1v8m0 0L4.5 6.5M7 9l2.5-2.5M2 12h10"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Download QR (PNG)
        </button>
      </div>
    </div>
  );
}
