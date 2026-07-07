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
  const { events, rosters, squadPresets, canAdmin, assignments = [], groups = [] } = context;
  const reserveUsers = await getUsersByIds(assignments.map((assignment) => assignment.userId));

  return (
    <>
      <PageHeader
        title={dictionary.roster.createRoster}
        description="Draft a roster from the squad preset structure and reshape it before publishing."
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
        />
      </div>
    </>
  );
}
