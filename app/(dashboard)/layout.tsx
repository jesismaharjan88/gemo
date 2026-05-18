import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Secondary auth guard: proxy.ts is the first line of defence.
  // This prevents any flash of dashboard content if proxy is bypassed.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Onboarding gate: proxy.ts stays auth-only; app state lives here.
  const { data: host } = await supabase
    .from("hosts")
    .select("onboarded_at")
    .single();

  if (!host?.onboarded_at) redirect("/onboarding");

  return <>{children}</>;
}
