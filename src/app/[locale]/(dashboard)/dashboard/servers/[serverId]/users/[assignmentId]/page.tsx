import type { Metadata } from "next";
import { Activity, Shield, Skull, Swords, Target, Wrench } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { ResourceTable } from "@/components/app/resource-table";
import { StatCard } from "@/components/app/stat-card";
import { UserAssignmentForm } from "@/components/app/user-assignment-form";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getPaginatedRows } from "@/lib/data-table";
import { formatDateTime } from "@/lib/format";
import { formatPlatformIds } from "@/lib/platform-ids";
import { getAssignmentMetadata, getPlayerMetadata } from "@/lib/server-metadata";
import { flattenPlayerMatches, getPlayerStatsDocsCached, getPlayerStatsSummaryCached, sortPlayerMatches } from "@/lib/server-player-stats";
import { getServerContext } from "@/lib/server-context";
import {
  getEligibleUsersForServer,
  getServerUserAssignment,
  getUsersByIds,
} from "@/lib/server-user-management";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ serverId: string; assignmentId: string }>;
}): Promise<Metadata> {
  const { assignmentId } = await params;
  const assignment = await getAssignmentMetadata(assignmentId);
  const user = assignment ? await getPlayerMetadata(assignment.userId) : undefined;
  return {
    title: user ? `${user.name} ${getDictionary("en").userManagement.assignmentTitleSuffix}` : getDictionary("en").userManagement.editAssignment,
    description: getDictionary("en").userManagement.assignmentMetaDescription,
  };
}

export function generateStaticParams() {
  return [{ assignmentId: "sample-assignment" }];
}

export default async function ServerUserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; serverId: string; assignmentId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, serverId, assignmentId } = await params;
  const resolvedSearchParams = await searchParams;
  const safeLocale = isLocale(locale) ? locale : "en";
  const dictionary = getDictionary(safeLocale);
  const context = await getServerContext(serverId);
  if (!context) return null;
  const { server, groups = [], assignments } = context;

  const assignment = await getServerUserAssignment(assignmentId);
  const users = assignment ? await getUsersByIds([assignment.userId]) : [];
  const user = users[0];
  const eligibleUsers = await getEligibleUsersForServer(server, assignments);

  if (!assignment || !user) return null;

  const playerStatsDocs = await getPlayerStatsDocsCached(user.id);
  const sortedMatches = sortPlayerMatches(
    flattenPlayerMatches(playerStatsDocs),
    new Map(context.events.map((event) => [event.id, event])),
  );
  const recentSummary = await getPlayerStatsSummaryCached(user.id, context.events);
  const storedPerformance = user.performance;
  const paginatedMatches = getPaginatedRows({
    rows: sortedMatches,
    searchParams: resolvedSearchParams,
    getSearchText: (match) => {
      const event = context.events.find((item) => item.id === match.eventId);
      return [
        event?.name,
        match.mapName,
        match.playerName,
        match.sourceUrl,
      ].filter(Boolean).join(" ");
    },
  });
  const matchRows = paginatedMatches.rows.map((match) => ({
    ...match,
    id: match.eventId,
  }));

  function formatAverage(value: number) {
    return new Intl.NumberFormat(safeLocale, {
      maximumFractionDigits: 2,
      minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    }).format(value);
  }

  return (
    <>
      <PageHeader
        title={user.name}
        description={user.platformIds.length
          ? dictionary.userManagement.platformConnectedAs.replace("{platformId}", formatPlatformIds(user.platformIds))
          : dictionary.userManagement.platformNotConnected}
      />
      <div className="space-y-6 px-4 pb-6 lg:px-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <StatCard title={dictionary.userManagement.averageKills} value={formatAverage(storedPerformance?.averages.kills ?? recentSummary.averages.kills)} description={dictionary.userManagement.storedAverageDescription.replace("{count}", String(storedPerformance?.matchesPlayed ?? sortedMatches.length))} icon={Target} />
          <StatCard title={dictionary.userManagement.averageKd} value={formatAverage(storedPerformance?.averages.killDeathRatio ?? recentSummary.averages.killDeathRatio)} description={dictionary.userManagement.storedAverageDescription.replace("{count}", String(storedPerformance?.matchesPlayed ?? sortedMatches.length))} icon={Swords} />
          <StatCard title={dictionary.userManagement.averageDeaths} value={formatAverage(storedPerformance?.averages.deaths ?? recentSummary.averages.deaths)} description={dictionary.userManagement.storedAverageDescription.replace("{count}", String(storedPerformance?.matchesPlayed ?? sortedMatches.length))} icon={Skull} />
          <StatCard title={dictionary.userManagement.averageOffense} value={formatAverage(storedPerformance?.averages.offense ?? recentSummary.averages.offense)} description={dictionary.userManagement.storedAverageDescription.replace("{count}", String(storedPerformance?.matchesPlayed ?? sortedMatches.length))} icon={Activity} />
          <StatCard title={dictionary.userManagement.averageDefense} value={formatAverage(storedPerformance?.averages.defense ?? recentSummary.averages.defense)} description={dictionary.userManagement.storedAverageDescription.replace("{count}", String(storedPerformance?.matchesPlayed ?? sortedMatches.length))} icon={Shield} />
          <StatCard title={dictionary.userManagement.averageSupport} value={formatAverage(storedPerformance?.averages.support ?? recentSummary.averages.support)} description={dictionary.userManagement.storedAverageDescription.replace("{count}", String(storedPerformance?.matchesPlayed ?? sortedMatches.length))} icon={Wrench} />
        </div>
        <ResourceTable
          className="h-auto max-h-[32rem]"
          dictionary={dictionary}
          rows={matchRows}
          page={paginatedMatches.page}
          pageSize={paginatedMatches.pageSize}
          pageCount={paginatedMatches.pageCount}
          totalRows={paginatedMatches.totalRows}
          search={paginatedMatches.search}
          searchPlaceholder={dictionary.userManagement.matchHistorySearch}
          getHref={(match) => `/${safeLocale}/dashboard/servers/${serverId}/matches/${match.eventId}`}
          columns={[
            {
              key: "event",
              title: dictionary.userManagement.matchHistoryEvent,
              render: (match) => {
                const event = context.events.find((item) => item.id === match.eventId);
                return (
                  <div>
                    <div className="font-medium">{event?.name ?? dictionary.common.unknown}</div>
                    <div className="text-xs text-muted-foreground">{match.mapName ?? match.mapId}</div>
                  </div>
                );
              },
            },
            {
              key: "playedAt",
              title: dictionary.userManagement.matchHistoryPlayedAt,
              render: (match) => formatDateTime(match.endedAt ?? match.importedAt, context.discordConfig?.timezone, safeLocale === "cs" ? "cs-CZ" : "en-GB"),
            },
            {
              key: "kills",
              title: dictionary.userManagement.matchKills,
              render: (match) => match.kills,
            },
            {
              key: "kd",
              title: dictionary.userManagement.matchKd,
              render: (match) => formatAverage(match.killDeathRatio),
            },
            {
              key: "deaths",
              title: dictionary.userManagement.matchDeaths,
              render: (match) => match.deaths,
            },
            {
              key: "offense",
              title: dictionary.userManagement.matchOffense,
              render: (match) => match.offense,
            },
            {
              key: "defense",
              title: dictionary.userManagement.matchDefense,
              render: (match) => match.defense,
            },
            {
              key: "support",
              title: dictionary.userManagement.matchSupport,
              render: (match) => match.support,
            },
          ]}
        />
        <UserAssignmentForm locale={safeLocale} server={server} dictionary={dictionary} eligibleUsers={eligibleUsers} groups={groups} assignment={assignment} />
      </div>
    </>
  );
}
