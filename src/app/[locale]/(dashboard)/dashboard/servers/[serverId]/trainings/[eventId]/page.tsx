import { ConcludeEventButton } from "@/components/app/conclude-event-button";
import { EventFormPanel } from "@/components/app/event-form-panel";
import { PageHeader } from "@/components/app/page-header";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getEventStatusMeta } from "@/lib/event-status";
import { getServerContext } from "@/lib/server-context";

export default async function TrainingDetailPage({
  params,
}: {
  params: Promise<{ locale: string; serverId: string; eventId: string }>;
}) {
  const { locale, serverId, eventId } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const dictionary = getDictionary(safeLocale);
  const context = await getServerContext(serverId);
  if (!context) return null;
  const { events, canAdmin, topicPresets, discordConfig } = context;
  const event = events.find((item) => item.id === eventId && item.kind === "training");
  if (!event) return null;

  const statusMeta = getEventStatusMeta(event.status, dictionary);

  return (
    <>
      <PageHeader
        title={event.name}
        description={event.description}
        badge={statusMeta?.label}
        actions={canAdmin && event.status !== "concluded" ? (
          <ConcludeEventButton serverId={serverId} eventId={event.id} disabled={false} dictionary={dictionary} />
        ) : undefined}
      />
      <div className="px-4 lg:px-6">
        <EventFormPanel event={event} serverId={serverId} locale={locale} topicPresets={topicPresets} timezone={discordConfig?.timezone ?? "UTC"} canEdit={canAdmin} dictionary={dictionary} createMode={false} />
      </div>
    </>
  );
}
