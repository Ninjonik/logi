import { MatchDetails } from "@/components/app/match-details";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getServerMatchByEventId } from "@/lib/server-matches";
import { getServerContext } from "@/lib/server-context";

export default async function MatchStatsPage({
  params,
}: {
  params: Promise<{ locale: string; serverId: string; eventId: string }>;
}) {
  const { locale, serverId, eventId } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const dictionary = getDictionary(safeLocale);
  const context = await getServerContext(serverId);
  if (!context) return null;

  const event = context.events.find((item) => item.id === eventId && item.kind === "match");
  if (!event) return null;

  const match = await getServerMatchByEventId(eventId);

  return (
    <>
      <PageHeader
        title={event.name}
        description={dictionary.event.matchDetailDescription}
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="rounded-xl">
              <a href={`/${locale}/dashboard/servers/${serverId}/matches/${eventId}`}>{dictionary.common.openAction}</a>
            </Button>
            {match ? (
              <Button asChild variant="outline" className="rounded-xl">
                <a href={match.sourceUrl} target="_blank" rel="noreferrer">{dictionary.event.rawSource}</a>
              </Button>
            ) : null}
          </div>
        )}
      />
      <div className="space-y-6 px-4 pb-6 lg:px-6">
        {match ? (
          <MatchDetails match={match} dictionary={dictionary} timezone={context.discordConfig?.timezone} />
        ) : (
          <div className="rounded-2xl border border-dashed border-border/60 px-6 py-10 text-sm text-muted-foreground">
            {dictionary.event.noMatchLinked}
          </div>
        )}
      </div>
    </>
  );
}
