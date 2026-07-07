import type { Metadata } from "next";

import { PageHeader } from "@/components/app/page-header";
import { RosterBoard } from "@/components/app/roster-board";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getServerContext } from "@/lib/server-context";
import { getUsersByIds } from "@/lib/server-user-management";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ serverId: string; rosterId: string }>;
}): Promise<Metadata> {
  const { serverId, rosterId } = await params;
  const context = await getServerContext(serverId);
  const roster = context?.rosters.find((item) => item.id === rosterId);
  const event = context?.events.find((item) => item.id === roster?.eventId);
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
  const context = await getServerContext(serverId);
  if (!context) return null;
  const { rosters, events, canAdmin, assignments = [], groups = [], discordConfig } = context;
  const roster = rosters.find((item) => item.id === rosterId);
  const event = events.find((item) => item.id === roster?.eventId);
  const users = await getUsersByIds(assignments.map((assignment) => assignment.userId));

  return (
    <>
      <PageHeader
        title={event ? `${event.name} roster` : "Roster"}
      />
      <div className="px-4 lg:px-6">
        <RosterBoard roster={roster} event={event} users={users} userAssignments={assignments} groups={groups} canAdmin={canAdmin} dictionary={dictionary} serverId={serverId} locale={locale} timezone={discordConfig?.timezone} defaultEditMode={false} />
      </div>
    </>
  );
}
