"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

type Props = {
  eventId: string;
  current: number | null;
  onSuccess: (newCount: number | null) => void;
};

export default function ExpectedCountEditor({ eventId, current, onSuccess }: Props) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current?.toString() ?? "");

  function openEditor() {
    setValue(current?.toString() ?? "");
    setEditing(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    const parsed = trimmed === "" ? null : parseInt(trimmed, 10);
    if (parsed !== null && (isNaN(parsed) || parsed <= 0)) {
      toast.error("Expected count must be a positive number.");
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.rpc("set_expected_guests", {
        p_event_id: eventId,
        p_count: parsed,
      });
      if (error) {
        toast.error("Couldn't update expected count. Try again.");
        return;
      }
      setEditing(false);
      onSuccess(parsed);
    });
  }

  if (editing) {
    return (
      <form onSubmit={handleSubmit} className="flex items-center gap-2 flex-shrink-0">
        <input
          type="number"
          min="1"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. 20"
          className="w-20 text-sm px-2 py-1.5 rounded-[10px] border text-right"
          style={{
            borderColor: "var(--border-med)",
            color: "var(--text)",
            backgroundColor: "var(--bg)",
          }}
          autoFocus
        />
        <button
          type="submit"
          disabled={isPending}
          className="text-sm px-3 py-1.5 rounded-[10px] text-white transition-opacity"
          style={{ backgroundColor: "var(--green)", opacity: isPending ? 0.6 : 1 }}
        >
          {isPending ? "…" : "Set"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={isPending}
          className="text-sm px-2 py-1.5 rounded-[10px]"
          style={{ color: "var(--muted)" }}
        >
          Cancel
        </button>
      </form>
    );
  }

  return (
    <button
      type="button"
      onClick={openEditor}
      className="flex-shrink-0 flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-[10px] border transition-colors"
      style={{ borderColor: "var(--border-med)", color: "var(--muted)" }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path
          d="M8.5 1.5a1.414 1.414 0 0 1 2 2L3.5 10.5l-2.5.5.5-2.5 7-7z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {current != null ? `Expected: ${current}` : "Set expected count"}
    </button>
  );
}
