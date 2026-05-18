import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/actions/auth";
import { APP_NAME } from "@/lib/constants";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: host } = await supabase
    .from("hosts")
    .select("name")
    .single();

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      <header
        className="border-b px-6 py-4 flex items-center justify-between"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <span
          className="text-xl"
          style={{ fontFamily: "var(--font-dm-serif)", color: "var(--text)" }}
        >
          {APP_NAME}
        </span>
        <form action={logout}>
          <button
            type="submit"
            className="text-sm font-medium px-4 py-2 rounded-[10px]"
            style={{ color: "var(--muted)" }}
          >
            Sign out
          </button>
        </form>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1
          className="text-3xl mb-2"
          style={{ fontFamily: "var(--font-dm-serif)", color: "var(--text)" }}
        >
          Welcome{host?.name ? `, ${host.name}` : ""}
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--muted)" }}>
          {user.email}
        </p>

        <div
          className="rounded-[16px] p-8 text-center"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Your events will appear here. Event creation coming in the next milestone.
          </p>
        </div>
      </main>
    </div>
  );
}
