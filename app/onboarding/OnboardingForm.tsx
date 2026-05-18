"use client";

import { useActionState } from "react";
import { updateHostProfile, type ProfileState } from "@/app/actions/host";

const initialState: ProfileState = {};

export default function OnboardingForm({
  emailPrefix,
  next,
}: {
  emailPrefix: string;
  next: string;
}) {
  const [state, formAction, pending] = useActionState(
    updateHostProfile,
    initialState
  );

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="next" value={next} />

      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium mb-2"
          style={{ color: "var(--text)" }}
        >
          What should we call you?
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={100}
          placeholder={emailPrefix}
          autoFocus
          className="w-full px-4 py-3 rounded-[10px] text-sm outline-none transition-colors"
          style={{
            backgroundColor: "var(--bg)",
            border: "1px solid var(--border-med)",
            color: "var(--text)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--green)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--border-med)";
          }}
        />
        {state?.error && (
          <p className="mt-2 text-sm" style={{ color: "#dc2626" }} role="alert">
            {state.error}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full py-3 px-4 rounded-[10px] text-sm font-medium transition-opacity"
        style={{
          backgroundColor: "var(--green)",
          color: "#fff",
          opacity: pending ? 0.6 : 1,
        }}
      >
        {pending ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
