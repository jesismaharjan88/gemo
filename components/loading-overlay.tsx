"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

// ── Context ────────────────────────────────────────────────────────────────────

type LoadingCtx = { show: () => void; hide: () => void };
const LoadingContext = createContext<LoadingCtx | null>(null);

export function useLoadingOverlay(): LoadingCtx {
  const ctx = useContext(LoadingContext);
  if (!ctx) throw new Error("useLoadingOverlay must be used inside LoadingProvider");
  return ctx;
}

// ── Overlay UI ─────────────────────────────────────────────────────────────────

const DOT_DELAYS = ["0s", "0.15s", "0.3s"];

function LoadingOverlay() {
  return (
    <div
      role="status"
      aria-label="Loading, please wait"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9990,
        backgroundColor: "rgba(0, 0, 0, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 20,
        pointerEvents: "all",
        touchAction: "none",
        animation: "gemo-overlay-in 0.18s ease-out both",
      }}
    >
      {/* Three-dot wave */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {DOT_DELAYS.map((delay, i) => (
          <span
            key={i}
            style={{
              width: 13,
              height: 13,
              borderRadius: "50%",
              backgroundColor: "var(--green)",
              display: "block",
              animation: `gemo-wave 1.1s ease-in-out ${delay} infinite`,
            }}
          />
        ))}
      </div>

      <span
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: "rgba(255, 255, 255, 0.75)",
          letterSpacing: "0.03em",
        }}
      >
        Loading…
      </span>
    </div>
  );
}

// ── Navigation watcher ─────────────────────────────────────────────────────────

function NavigationWatcher() {
  const { show, hide } = useLoadingOverlay();
  const pathname = usePathname();

  // Every pathname change means navigation completed → hide the overlay.
  // Runs on mount too, which is fine — hide() is a no-op when nothing is loading.
  useEffect(() => {
    hide();
    // hide is stable (useCallback with no deps), so this effect only re-runs
    // when pathname changes, which is exactly when we want to dismiss.
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show overlay when the user clicks a same-app link
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as Element).closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = anchor.getAttribute("href") ?? "";

      // Ignore: external, protocol-relative, hash-only, special schemes, downloads, new-tab
      if (
        !href ||
        href.startsWith("http") ||
        href.startsWith("//") ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        anchor.hasAttribute("download") ||
        anchor.target === "_blank"
      ) return;

      // Ignore: modifier keys (user wants to open in new tab, etc.)
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      // Ignore: navigating to the current path (no page change will happen)
      const targetPath = href.split("?")[0].split("#")[0];
      if (targetPath && targetPath === window.location.pathname) return;

      show();
    }

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [show]);

  return null;
}

// ── Provider ───────────────────────────────────────────────────────────────────

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);

  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (showTimerRef.current) { clearTimeout(showTimerRef.current); showTimerRef.current = null; }
    if (safetyTimerRef.current) { clearTimeout(safetyTimerRef.current); safetyTimerRef.current = null; }
    setIsLoading(false);
  }, []);

  const show = useCallback(() => {
    // Small debounce so instant navigations never flash the overlay
    if (showTimerRef.current) clearTimeout(showTimerRef.current);
    showTimerRef.current = setTimeout(() => {
      setIsLoading(true);
      // Auto-hide safety net — overlay can never be stuck for more than 8 s
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = setTimeout(() => setIsLoading(false), 8_000);
    }, 150);
  }, []);

  // Stable context value — only recreated when show/hide identities change (they don't)
  const ctx = useMemo(() => ({ show, hide }), [show, hide]);

  return (
    <LoadingContext.Provider value={ctx}>
      <NavigationWatcher />
      {children}
      {isLoading && <LoadingOverlay />}
    </LoadingContext.Provider>
  );
}
