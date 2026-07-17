import type { Metadata } from "next";

import { EventFormPanel } from "@/components/app/event-form-panel";
import { PageHeader } from "@/components/app/page-header";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getServerContext } from "@/lib/server-context";

export default async function CreateEventPage({
  params,
}: {
  params: Promise<{ locale: string; serverId: string }>;
}) {
  const { locale, serverId } = await params;
  const dictionary = getDictionary(isLocale(locale) ? locale : "en");
  const context = await getServerContext(serverId);
  const canAdmin = context?.canAdmin ?? false;
  const topicPresets = context?.topicPresets ?? [];
  const timezone = context?.discordConfig?.timezone ?? "UTC";

  const draftEvent = {
    id: "draft-event",
    guildId: serverId,
    kind: "match" as const,
    name: "",
    description: "",
    thumbnailUrl: "",
    meetingChannelId: "",
    requiredRoleIds: [],
    rewardRoleIds: [],
    server: "",
    serverPassword: "",
    side: "",
    map: "",
    cap: "",
    notes: "",
    registrationEnd: "2026-07-12T14:00:00.000Z",
    meetingStart: "2026-07-12T14:30:00.000Z",
    gameStart: "2026-07-12T15:00:00.000Z",
    gameEnd: "2026-07-12T17:00:00.000Z",
    pingClan: false,
    createForumChannel: true,
    status: "registration" as const,
    statusUpdatedAt: "2026-07-06T18:00:00.000Z",
    attendanceReminderLog: [],
    participants: [],
    signUps: [],
    createdAt: "2026-07-06T18:00:00.000Z",
    updatedAt: "2026-07-06T18:00:00.000Z",
  };

  return (
    <>
      <PageHeader title={dictionary.event.createTitle} description={dictionary.event.createPageDescription} />
      <div className="px-4 lg:px-6">
        <EventFormPanel event={draftEvent} serverId={serverId} locale={locale} topicPresets={topicPresets} timezone={timezone} canEdit={canAdmin} dictionary={dictionary} createMode />
      </div>
    </>
  );
}
