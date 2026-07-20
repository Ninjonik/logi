import type { Metadata } from "next";

import { LiveRosterBoard } from "@/components/app/live-roster-board";
import { PageHeader } from "@/components/app/page-header";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getLoggedInUser } from "@/lib/auth";
import { getEventMetadata, getRosterMetadata } from "@/lib/server-metadata";
import { getServerContext } from "@/lib/server-context";
import { getUsersByIds } from "@/lib/server-user-management";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ serverId: string; rosterId: string }>;
}): Promise<Metadata> {
  const { rosterId } = await params;
  const roster = await getRosterMetadata(rosterId);
  const event = roster?.eventId ? await getEventMetadata(String(roster.eventId)) : null;
  return {
    title: event ? `${event.name} roster` : "Roster",
    description: "Roster board with reserves, role slots, publish state, and acknowledgements.",
  };
}

export function generateStaticParams() {
  return [{ rosterId: "sample-roster" }];
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
  const user = await getLoggedInUser();
  if (!user) return null;

  return (
    <>
      <PageHeader
        title={event ? `${event.name} roster` : "Roster"}
      />
      <div className="px-4 lg:px-6">
        <LiveRosterBoard
          rosterId={rosterId}
          serverId={serverId}
          locale={locale}
          userId={user.discordId}
          dictionary={dictionary}
          initialRoster={roster}
          initialEvent={event}
          initialUsers={users}
          initialAssignments={assignments}
          initialGroups={groups}
          initialCanAdmin={canAdmin}
          initialDiscordConfig={discordConfig}
        />
      </div>
    </>
  );
}
