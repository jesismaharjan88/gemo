import { Suspense } from "react";
import type { Metadata } from "next";
import { APP_NAME } from "@/lib/constants";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: `Sign in — ${APP_NAME}`,
};

export default function LoginPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
      style={{ backgroundColor: "var(--bg)" }}
    >
      <div
        className="w-full max-w-sm rounded-[16px] p-8"
        style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border-med)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        }}
      >
        <div className="mb-8 text-center">
          <span
            className="text-2xl"
            style={{ fontFamily: "var(--font-dm-serif)", color: "var(--text)" }}
          >
            {APP_NAME}
          </span>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            Sign in or create an account
          </p>
        </div>

        <Suspense fallback={<FormSkeleton />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-11 rounded-[10px] animate-pulse" style={{ backgroundColor: "var(--bg)" }} />
      <div className="h-11 rounded-[10px] animate-pulse" style={{ backgroundColor: "var(--bg)" }} />
    </div>
  );
}
