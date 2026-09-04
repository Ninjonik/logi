import { fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";

import { appCacheTags, cachedRead } from "@/lib/cache-tags";
import { getInternalAuthSecret } from "@/lib/env";

const getRecentMatchSummaryReference = makeFunctionReference<"query">("serverDashboard:getRecentMatchSummaryInternal");

export type RecentMatchSummary = {
  recentMatches: Array<{ id: string; name: string; endedAt: string; outcome: "victory" | "defeat" | "draw"; score: { sideA: number; sideB: number } }>;
  wins: number;
  losses: number;
  winRate: number;
  topPlayers: Array<{
    id: string;
    name: string;
    matches: number;
    kills: number;
    deaths: number;
    roles: Array<{ name: string; icon?: string }>;
  }>;
};

/** Call only after the server-context access check has succeeded. */
export async function getRecentMatchSummary(serverId: string): Promise<RecentMatchSummary | null> {
  return await cachedRead(
    ["server-recent-match-summary:v4", serverId],
    [appCacheTags.serverContext(serverId), appCacheTags.matches(serverId)],
    async () => (await fetchQuery(getRecentMatchSummaryReference, { secret: getInternalAuthSecret(), serverId: serverId as never })) as RecentMatchSummary | null,
    3600,
  );
}
