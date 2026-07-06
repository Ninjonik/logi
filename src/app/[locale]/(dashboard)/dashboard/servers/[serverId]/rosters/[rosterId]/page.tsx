import type { Metadata } from "next";

import { PageHeader } from "@/components/app/page-header";
import { RosterBoard } from "@/components/app/roster-board";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { mockUsers } from "@/lib/mock-data";
import { getServerContext } from "@/lib/server-context";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ serverId: string; rosterId: string }>;
}): Promise<Metadata> {
  const { serverId, rosterId } = await params;
  const context = getServerContext(serverId);
  const roster = context.rosters.find((item) => item.id === rosterId);
  const event = context.events.find((item) => item.id === roster?.eventId);
  return {
    title: event ? `${event.name} roster` : "Roster",
    description: "Roster board with reserves, role slots, publish state, and acknowledgements.",
  };
}

export default async function RosterDetailPage({
  params,
}: {
  params: Promise<{ locale: string; serverId: string; rosterId: string }>;
}) {
  const { locale, serverId, rosterId } = await params;
  const dictionary = getDictionary(isLocale(locale) ? locale : "en");
  const { rosters, events, canAdmin } = getServerContext(serverId);
  const roster = rosters.find((item) => item.id === rosterId);
  const event = events.find((item) => item.id === roster?.eventId);

  return (
    <>
      <PageHeader
        title={event ? `${event.name} roster` : "Roster"}
        description="Inspired by competitive roster boards: grouped squads, visible reserves, assignment status, and a future-ready acknowledgement flow."
      />
      <div className="px-4 lg:px-6">
        <RosterBoard roster={roster} event={event} users={mockUsers} canAdmin={canAdmin} dictionary={dictionary} />
      </div>
    </>
  );
}
