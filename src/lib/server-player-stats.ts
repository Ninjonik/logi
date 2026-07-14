import { cacheLife, cacheTag } from "next/cache";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";

import { getInternalAuthSecret } from "@/lib/env";
import type { EventRecord, PlayerMatchStats } from "@/types/domain";

const listPlayerStatsForUserReference = makeFunctionReference<"query">("playerStats:listForUser");
const upsertPlayerMatchesReference = makeFunctionReference<"mutation">("playerStats:upsertMatches");

type PlayerStatsDoc = {
  id: string;
  userId?: string;
  latestName?: string;
  updatedAt: string;
  matches: Record<string, Omit<PlayerMatchStats, "eventId">>;
};

export type PlayerStatsSummary = {
  totalMatches: number;
  lastTenMatches: number;
  averages: {
    kills: number;
    killDeathRatio: number;
    deaths: number;
    offense: number;
    defense: number;
    support: number;
  };
};

export async function savePlayerMatchStats(input: {
  entries: Array<{
    id: string;
    userId?: string;
    latestName: string;
    eventId: string;
    match: Omit<PlayerMatchStats, "eventId">;
  }>;
}) {
  if (input.entries.length === 0) {
    return { ok: true, count: 0 };
  }

  return await fetchMutation(upsertPlayerMatchesReference, {
    secret: getInternalAuthSecret(),
    entries: input.entries as never,
  });
}

export async function getPlayerStatsDocs(userId: string) {
  return (await fetchQuery(listPlayerStatsForUserReference, {
    userId,
  })) as PlayerStatsDoc[];
}

export async function getPlayerStatsDocsCached(userId: string) {
  "use cache";

  cacheLife("weeks");
  cacheTag(`player-stats:${userId}`);

  return await getPlayerStatsDocs(userId);
}

export async function getPlayerStatsSummaryCached(userId: string, events: EventRecord[]) {
  "use cache";

  cacheLife("weeks");
  cacheTag(`player-stats:${userId}`);

  const docs = await getPlayerStatsDocs(userId);
  const sortedMatches = sortPlayerMatches(
    flattenPlayerMatches(docs),
    new Map(events.map((event) => [event.id, event])),
  );

  return buildPlayerStatsSummary(sortedMatches);
}

export function flattenPlayerMatches(docs: PlayerStatsDoc[]): PlayerMatchStats[] {
  return docs.flatMap((doc) =>
    Object.entries(doc.matches).map(([eventId, match]) => ({
      eventId,
      ...match,
    })),
  );
}

export function sortPlayerMatches(matches: PlayerMatchStats[], eventById?: Map<string, EventRecord>) {
  return [...matches].sort((left, right) => {
    const leftDate = eventById?.get(left.eventId)?.gameEnd ?? left.endedAt ?? left.importedAt;
    const rightDate = eventById?.get(right.eventId)?.gameEnd ?? right.endedAt ?? right.importedAt;
    return new Date(rightDate).getTime() - new Date(leftDate).getTime();
  });
}

export function buildPlayerStatsSummary(matches: PlayerMatchStats[]): PlayerStatsSummary {
  const lastTen = matches.slice(0, 10);
  const divisor = lastTen.length || 1;
  const totals = lastTen.reduce((acc, match) => ({
    kills: acc.kills + match.kills,
    killDeathRatio: acc.killDeathRatio + match.killDeathRatio,
    deaths: acc.deaths + match.deaths,
    offense: acc.offense + match.offense,
    defense: acc.defense + match.defense,
    support: acc.support + match.support,
  }), {
    kills: 0,
    killDeathRatio: 0,
    deaths: 0,
    offense: 0,
    defense: 0,
    support: 0,
  });

  return {
    totalMatches: matches.length,
    lastTenMatches: lastTen.length,
    averages: {
      kills: totals.kills / divisor,
      killDeathRatio: totals.killDeathRatio / divisor,
      deaths: totals.deaths / divisor,
      offense: totals.offense / divisor,
      defense: totals.defense / divisor,
      support: totals.support / divisor,
    },
  };
}
