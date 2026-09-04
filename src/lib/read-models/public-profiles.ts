import { cacheLife, cacheTag } from "next/cache";
import { fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";

import { appCacheTags } from "@/lib/cache-tags";
import type { MatchRecord } from "@/types/domain";

const getPublicPlayerReference = makeFunctionReference<"query">("publicProfiles:getPlayer");
const getPublicMatchReference = makeFunctionReference<"query">("publicProfiles:getMatch");
const getPublicClanReference = makeFunctionReference<"query">("publicProfiles:getClan");
const listPublicClansReference = makeFunctionReference<"query">("publicProfiles:listClans");
const listPublicMatchesReference = makeFunctionReference<"query">("publicProfiles:listMatches");
const searchPublicPlayersReference = makeFunctionReference<"query">("publicProfiles:searchPlayers");

export type PublicPlayerProfile = Awaited<ReturnType<typeof getPublicPlayerProfile>>;

export async function getPublicPlayerProfile(playerId: string) {
  "use cache";
  cacheLife("max");
  cacheTag(appCacheTags.publicProfile(playerId));
  cacheTag(appCacheTags.player(playerId));
  cacheTag(appCacheTags.playerStats(playerId));
  return await fetchQuery(getPublicPlayerReference, { playerId }) as {
    id: string; name: string; avatar: string; clans: Array<{ id: string; name: string; avatar: string }>;
    stats: { matches: number; kills: number; deaths: number; kd: number };
    recentMatches: Array<{ eventId: string; name: string; endedAt: string; mapName?: string; kills: number; deaths: number; killDeathRatio: number; offense: number; defense: number; support: number }>;
    updatedAt: string;
  } | null;
}

export async function getPublicMatch(eventId: string) {
  "use cache";
  cacheLife("max");
  cacheTag(appCacheTags.publicMatch(eventId));
  cacheTag(appCacheTags.match(eventId));
  return await fetchQuery(getPublicMatchReference, { eventId: eventId as never }) as MatchRecord | null;
}

export async function getPublicClan(guildId: string) {
  "use cache";
  cacheLife("max");
  cacheTag(appCacheTags.publicClan(guildId));
  cacheTag(appCacheTags.publicDiscovery());
  return await fetchQuery(getPublicClanReference, { guildId }) as {
    id: string; name: string; avatar: string; description?: string; memberCount: number; stats: { matches: number; wins: number; winRate: number };
    recentMatches: Array<{ eventId: string; name: string; gameEnd: string; mapName: string; score: { axis: number; allied: number }; outcome?: string; category?: string }>;
    updatedAt: string;
  } | null;
}

export async function listPublicClans(cursor: string | null) {
  "use cache";
  cacheLife("max");
  cacheTag(appCacheTags.publicDiscovery());
  return await fetchQuery(listPublicClansReference, { paginationOpts: { cursor, numItems: 12 } }) as PublicPage<{ id: string; name: string; avatar: string; description?: string; memberCount: number }>;
}

type PublicPage<T> = { page: T[]; continueCursor: string; isDone: boolean };

export async function listPublicMatches(cursor: string | null) {
  "use cache";
  cacheLife("max");
  cacheTag(appCacheTags.publicDiscovery());
  return await fetchQuery(listPublicMatchesReference, { paginationOpts: { cursor, numItems: 12 } }) as PublicPage<{
    eventId: string; name: string; gameEnd: string; clan: { id: string; name: string; avatar: string } | null;
    mapName: string; score: { axis: number; allied: number }; outcome?: string; category?: string;
  }>;
}

export async function searchPublicPlayers(term: string, cursor: string | null) {
  "use cache";
  cacheLife("max");
  cacheTag(appCacheTags.publicDiscovery());
  return await fetchQuery(searchPublicPlayersReference, { term, paginationOpts: { cursor, numItems: 12 } }) as PublicPage<{ id: string; name: string; avatar: string }>;
}
