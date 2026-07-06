import { PageHeader } from "@/components/app/page-header";
import { RosterBoard } from "@/components/app/roster-board";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { mockUsers } from "@/lib/mock-data";
import { getServerContext } from "@/lib/server-context";

export default async function CreateRosterPage({
  params,
}: {
  params: Promise<{ locale: string; serverId: string }>;
}) {
  const { locale, serverId } = await params;
  const dictionary = getDictionary(isLocale(locale) ? locale : "en");
  const { events, squadPresets, canAdmin } = getServerContext(serverId);
  const event = events[0];
  const preset = squadPresets[0];

  const draftRoster =
    preset && event
      ? {
          id: "draft-roster",
          eventId: event.id,
          guildId: serverId,
          squadPresetId: preset.id,
          squads: preset.squads.map((squad) => ({
            name: squad.name,
            group: squad.group,
            order: squad.order,
            color: squad.color,
            players: squad.roles.flatMap((role) =>
              Array.from({ length: role.count }).map(() => ({
                roleName: role.name,
                ack: false,
                note: role.note,
              })),
            ),
          })),
          reservePlayerIds: mockUsers.slice(0, 4).map((user) => user.id),
          published: false,
          createdAt: "2026-07-06T18:00:00.000Z",
          updatedAt: "2026-07-06T18:00:00.000Z",
        }
      : undefined;

  return (
    <>
      <PageHeader title="Create roster" description="Draft a roster from the squad preset structure and reshape it before publishing." />
      <div className="px-4 lg:px-6">
        <RosterBoard roster={draftRoster} event={event} users={mockUsers} canAdmin={canAdmin} dictionary={dictionary} />
      </div>
    </>
  );
}
