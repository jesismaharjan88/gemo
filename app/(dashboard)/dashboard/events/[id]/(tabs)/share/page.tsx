export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SharePanel from "@/components/events/share-panel";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function SharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();

  const { data: event, error } = await supabase
    .from("events")
    .select("id, slug, title, status")
    .eq("id", id)
    .single();

  if (error?.code === "22P02") notFound();
  if (!event) notFound();

  const statusMessage =
    event.status === "draft"
      ? {
          heading: "Publish this event first",
          body: "The guest link only works once the event is active. Publish it from the Overview tab, then come back here to share.",
        }
      : event.status === "closed" || event.status === "archived"
      ? {
          heading: "This event is closed",
          body: "Responses are no longer being accepted. The share link is inactive.",
        }
      : null;

  return (
    <main className="max-w-2xl mx-auto px-4 py-10 space-y-4">
      {statusMessage ? (
        <div
          className="rounded-[16px] p-8 text-center"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <p
            className="text-base font-medium"
            style={{ fontFamily: "var(--font-dm-serif)", color: "var(--text)" }}
          >
            {statusMessage.heading}
          </p>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: "var(--muted)" }}>
            {statusMessage.body}
          </p>
        </div>
      ) : (
        <SharePanel slug={event.slug} title={event.title} />
      )}
    </main>
  );
}
