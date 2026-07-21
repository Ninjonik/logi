import { PageHeader } from "@/components/app/page-header";
import { RosterCreator } from "@/components/app/roster-creator";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getServerContext } from "@/lib/server-context";
import { getUsersByIds } from "@/lib/server-user-management";

export default async function CreateRosterPage({
  params,
}: {
  params: Promise<{ locale: string; serverId: string }>;
}) {
  const { locale, serverId } = await params;
  const dictionary = getDictionary(isLocale(locale) ? locale : "en");
  const context = await getServerContext(serverId);
  if (!context) return null;
  const { events, rosters, squadPresets, canAdmin, assignments = [], groups = [], discordConfig } = context;
  const rosterUserIds = Array.from(
    new Set([
      ...assignments.map((assignment) => assignment.userId),
      ...events.flatMap((event) => [
        ...event.signUps.map((signUp) => signUp.userId),
        ...event.participants.map((participant) => participant.userId),
      ]),
    ]),
  );
  const reserveUsers = await getUsersByIds(rosterUserIds);

  return (
    <>
      <PageHeader
        title={dictionary.common.createRoster}
        description={dictionary.shared.rosterPageDescription}
      />
      <div className="px-4 lg:px-6">
        <RosterCreator
          events={events}
          rosters={rosters}
          squadPresets={squadPresets}
          users={reserveUsers}
          userAssignments={assignments}
          groups={groups}
          canAdmin={canAdmin}
          dictionary={dictionary}
          serverId={serverId}
          locale={locale}
          timezone={discordConfig?.timezone}
        />
      </div>
    </>
  );
}
