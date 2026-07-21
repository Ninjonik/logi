import { EventFormPanel } from "@/components/app/event-form-panel";
import { PageHeader } from "@/components/app/page-header";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { createDraftEventSchedule } from "@/lib/event-draft";
import { getServerContext } from "@/lib/server-context";

export default async function CreateTrainingPage({
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
  const discordConfig = context?.discordConfig ?? null;
  const draftSchedule = createDraftEventSchedule();

  const draftEvent = {
    id: "draft-training",
    guildId: serverId,
    kind: "training" as const,
    name: "",
    description: "",
    thumbnailUrl: "",
    meetingChannelId: "",
    requiredRoleIds: [],
    rewardRoleIds: [],
    notes: "",
    registrationEnd: draftSchedule.registrationEnd,
    meetingStart: draftSchedule.meetingStart,
    gameStart: draftSchedule.meetingStart,
    gameEnd: draftSchedule.gameEnd,
    pingClan: false,
    createForumChannel: false,
    status: "registration" as const,
    statusUpdatedAt: draftSchedule.statusUpdatedAt,
    attendanceReminderLog: [],
    participants: [],
    signUps: [],
    absenceNotices: [],
    createdAt: draftSchedule.createdAt,
    updatedAt: draftSchedule.updatedAt,
  };

  return (
    <>
      <PageHeader title={dictionary.sidebar.trainings} description={dictionary.event.createPageDescription} />
      <div className="px-4 lg:px-6">
        <EventFormPanel event={draftEvent} serverId={serverId} locale={locale} topicPresets={topicPresets} timezone={timezone} canEdit={canAdmin} dictionary={dictionary} createMode discordConfig={discordConfig} />
      </div>
    </>
  );
}
