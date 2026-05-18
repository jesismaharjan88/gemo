"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Status = "idle" | "loading" | "success" | "error";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
    } else {
      setStatus("success");
    }
  }

  if (status === "success") {
    return (
      <div className="text-center space-y-3">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center mx-auto text-xl"
          style={{ backgroundColor: "var(--green-light)", color: "var(--green)" }}
        >
          ✓
        </div>
        <p className="font-medium text-sm" style={{ color: "var(--text)" }}>
          Check your inbox
        </p>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          We sent a magic link to{" "}
          <span className="font-medium" style={{ color: "var(--text)" }}>
            {email}
          </span>
          . Click the link to sign in.
        </p>
        <button
          type="button"
          onClick={() => {
            setStatus("idle");
            setEmail("");
          }}
          className="text-xs underline"
          style={{ color: "var(--subtle)" }}
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium mb-1.5"
          style={{ color: "var(--text)" }}
        >
          Email address
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full px-4 py-2.5 rounded-[10px] text-sm outline-none transition-colors"
          style={{
            border: "1px solid var(--border-med)",
            backgroundColor: "var(--surface)",
            color: "var(--text)",
          }}
          onFocus={(e) =>
            (e.currentTarget.style.borderColor = "var(--green)")
          }
          onBlur={(e) =>
            (e.currentTarget.style.borderColor = "var(--border-med)")
          }
        />
      </div>

      {status === "error" && (
        <p
          className="text-sm rounded-[10px] px-3 py-2"
          style={{
            color: "#b91c1c",
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
          }}
        >
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "loading" || !email}
        className="w-full py-2.5 rounded-[10px] text-sm font-semibold text-white transition-opacity disabled:opacity-60"
        style={{ backgroundColor: "var(--green)" }}
      >
        {status === "loading" ? "Sending…" : "Send magic link"}
      </button>

      <p className="text-xs text-center" style={{ color: "var(--subtle)" }}>
        No password needed. We&apos;ll email you a sign-in link.{" "}
        <Link href="/" className="underline" style={{ color: "var(--green-text)" }}>
          Back to home
        </Link>
      </p>
    </form>
  );
}
