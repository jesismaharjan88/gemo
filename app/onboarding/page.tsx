import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { APP_NAME } from "@/lib/constants";
import OnboardingForm from "./OnboardingForm";

export const metadata = { title: `Welcome — ${APP_NAME}` };

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: host } = await supabase
    .from("hosts")
    .select("onboarded_at")
    .single();

  if (host?.onboarded_at) redirect("/dashboard");

  const { next } = await searchParams;
  const destination = next ?? "/dashboard";
  const emailPrefix = (user.email ?? "").split("@")[0];

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: "var(--bg)" }}
    >
      <div
        className="w-full max-w-sm rounded-[16px] p-8"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <h1
          className="text-2xl mb-1"
          style={{ fontFamily: "var(--font-dm-serif)", color: "var(--text)" }}
        >
          Welcome to {APP_NAME}
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--muted)" }}>
          One quick thing before we start.
        </p>

        <OnboardingForm emailPrefix={emailPrefix} next={destination} />
      </div>
    </div>
  );
}
