import type { Metadata } from "next";

import { CalendarView } from "@/components/app/calendar-view";
import { PageHeader } from "@/components/app/page-header";
import { getServerContext } from "@/lib/server-context";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ serverId: string }>;
}): Promise<Metadata> {
  const { serverId } = await params;
  const context = getServerContext(serverId);
  return {
    title: `${context.server?.name ?? "Server"} calendar`,
    description: "Upcoming and past events with roster visibility preview.",
  };
}

export default async function ServerCalendarPage({
  params,
}: {
  params: Promise<{ locale: string; serverId: string }>;
}) {
  const { locale, serverId } = await params;
  const { server, events, rosters } = getServerContext(serverId);
  if (!server) return null;

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Use the calendar to browse upcoming and past events, then jump into full event details or the published roster."
      />
      <div className="px-4 lg:px-6">
        <CalendarView locale={locale as "en"} serverId={serverId} events={events} rosters={rosters} />
      </div>
    </>
  );
}
