import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EventDetailHeader from "@/components/events/event-detail-header";
import TabsNav from "@/components/events/tabs-nav";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EventTabsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();

  const { data: event, error } = await supabase
    .from("events")
    .select("id, slug, title, venue_name, event_datetime, status")
    .eq("id", id)
    .single();

  if (error?.code === "22P02") notFound();
  if (!event) notFound();

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      <div className="print:hidden">
        <EventDetailHeader event={event} />
        <TabsNav eventId={id} />
      </div>
      {children}
    </div>
  );
}
