"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

type Props = {
  eventId: string;
  status: string;
};

type ConfirmConfig = {
  title: string;
  body: string;
  confirmLabel: string;
  targetStatus: string;
};

const CONFIRM_CONFIGS: Record<string, ConfirmConfig> = {
  close: {
    title: "Close this event?",
    body: "Guests will no longer be able to submit responses. You can reopen the event later.",
    confirmLabel: "Close event",
    targetStatus: "closed",
  },
  discard: {
    title: "Discard this draft?",
    body: "This will close the event without publishing it. You can reopen it later if needed.",
    confirmLabel: "Discard",
    targetStatus: "closed",
  },
};

function ConfirmDialog({
  config,
  onConfirm,
  onCancel,
  isPending,
}: {
  config: ConfirmConfig;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-[16px] p-6 space-y-4"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-medium" style={{ color: "var(--text)" }}>
          {config.title}
        </h2>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          {config.body}
        </p>
        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="px-4 py-2 rounded-[10px] text-sm font-medium border"
            style={{ borderColor: "var(--border-med)", color: "var(--muted)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="px-4 py-2 rounded-[10px] text-sm font-medium text-white transition-opacity"
            style={{ backgroundColor: "#dc2626", opacity: isPending ? 0.6 : 1 }}
          >
            {isPending ? "Working…" : config.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EventActions({ eventId, status }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmKey, setConfirmKey] = useState<"close" | "discard" | null>(null);

  async function transition(targetStatus: string) {
    const supabase = createClient();
    const { error } = await supabase.rpc("set_event_status", {
      p_event_id: eventId,
      p_status: targetStatus,
    });
    if (error) {
      toast.error("Couldn't update event. Try again.");
      return;
    }
    toast.success(
      targetStatus === "active"
        ? "Event published."
        : targetStatus === "closed"
        ? "Event closed."
        : "Event reopened."
    );
    router.refresh();
  }

  function handleDirectAction(targetStatus: string) {
    startTransition(() => transition(targetStatus));
  }

  function handleConfirmed() {
    if (!confirmKey) return;
    const target = CONFIRM_CONFIGS[confirmKey].targetStatus;
    setConfirmKey(null);
    startTransition(() => transition(target));
  }

  if (status === "draft") {
    return (
      <>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => handleDirectAction("active")}
            disabled={isPending}
            className="px-5 py-2.5 rounded-[10px] text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--green)", opacity: isPending ? 0.6 : 1 }}
          >
            {isPending ? "Working…" : "Publish"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmKey("discard")}
            disabled={isPending}
            className="px-5 py-2.5 rounded-[10px] text-sm font-medium border transition-colors"
            style={{ borderColor: "#fca5a5", color: "#dc2626" }}
          >
            Discard
          </button>
        </div>

        {confirmKey === "discard" && (
          <ConfirmDialog
            config={CONFIRM_CONFIGS.discard}
            onConfirm={handleConfirmed}
            onCancel={() => setConfirmKey(null)}
            isPending={isPending}
          />
        )}
      </>
    );
  }

  if (status === "active") {
    return (
      <>
        <div>
          <button
            type="button"
            onClick={() => setConfirmKey("close")}
            disabled={isPending}
            className="px-5 py-2.5 rounded-[10px] text-sm font-medium border transition-colors"
            style={{ borderColor: "#fca5a5", color: "#dc2626" }}
          >
            Close event
          </button>
        </div>

        {confirmKey === "close" && (
          <ConfirmDialog
            config={CONFIRM_CONFIGS.close}
            onConfirm={handleConfirmed}
            onCancel={() => setConfirmKey(null)}
            isPending={isPending}
          />
        )}
      </>
    );
  }

  if (status === "closed") {
    return (
      <div>
        <button
          type="button"
          onClick={() => handleDirectAction("active")}
          disabled={isPending}
          className="px-5 py-2.5 rounded-[10px] text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--green)", opacity: isPending ? 0.6 : 1 }}
        >
          {isPending ? "Working…" : "Reopen"}
        </button>
      </div>
    );
  }

  return null;
}
