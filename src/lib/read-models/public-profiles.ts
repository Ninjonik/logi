import { fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";

import { appCacheTags, cachedRead } from "@/lib/cache-tags";
import type { MatchRecord } from "@/types/domain";

const getPublicPlayerReference = makeFunctionReference<"query">("publicProfiles:getPlayer");
const getPublicMatchReference = makeFunctionReference<"query">("publicProfiles:getMatch");
const getPublicClanReference = makeFunctionReference<"query">("publicProfiles:getClan");
const listPublicClansReference = makeFunctionReference<"query">("publicProfiles:listClans");
const listPublicMatchesReference = makeFunctionReference<"query">("publicProfiles:listMatches");
const searchPublicPlayersReference = makeFunctionReference<"query">("publicProfiles:searchPlayers");
const getPublicPreviewReference = makeFunctionReference<"query">("publicPreviews:get");

export type PublicPlayerProfile = Awaited<ReturnType<typeof getPublicPlayerProfile>>;

export async function getPublicPreview(entityType: "player" | "clan" | "match", entityId: string) {
  const tag = entityType === "match" ? appCacheTags.publicMatch(entityId) : entityType === "clan" ? appCacheTags.publicClan(entityId) : appCacheTags.publicProfile(entityId);
  return await cachedRead(["public-preview", entityType, entityId], [appCacheTags.publicDiscovery(), tag], async () => (await fetchQuery(getPublicPreviewReference, { entityType, entityId })) as { title: string; description: string; imageVersion: string } | null, 86400);
}

export async function getPublicPlayerProfile(playerId: string) {
  return await cachedRead(["public-player", playerId], [appCacheTags.publicProfile(playerId), appCacheTags.player(playerId), appCacheTags.playerStats(playerId)], async () => (await fetchQuery(getPublicPlayerReference, { playerId })) as {
    id: string; name: string; avatar: string; clans: Array<{ id: string; name: string; avatar: string }>;
    stats: { matches: number; kills: number; deaths: number; kd: number };
    recentMatches: Array<{ eventId: string; name: string; endedAt: string; mapName?: string; kills: number; deaths: number; killDeathRatio: number; offense: number; defense: number; support: number }>;
    updatedAt: string;
  } | null, 86400);
}

export async function getPublicMatch(eventId: string) {
  return await cachedRead(["public-match", eventId], [appCacheTags.publicMatch(eventId), appCacheTags.match(eventId)], async () => (await fetchQuery(getPublicMatchReference, { eventId: eventId as never })) as (MatchRecord & { eventName: string; thumbnailUrl?: string }) | null, 86400);
}

export async function getPublicClan(guildId: string) {
  return await cachedRead(["public-clan", guildId], [appCacheTags.publicClan(guildId), appCacheTags.publicDiscovery()], async () => (await fetchQuery(getPublicClanReference, { guildId })) as {
    id: string; name: string; avatar: string; description?: string; memberCount: number; stats: { matches: number; wins: number; winRate: number };
    recentMatches: Array<{ eventId: string; name: string; gameEnd: string; mapName: string; score: { axis: number; allied: number }; outcome?: string; category?: string }>;
    updatedAt: string;
  } | null, 86400);
}

export async function listPublicClans(cursor: string | null) {
  return (await fetchQuery(listPublicClansReference, { paginationOpts: { cursor, numItems: 12 } })) as PublicPage<{ id: string; name: string; avatar: string; description?: string; memberCount: number }>;
}

type PublicPage<T> = { page: T[]; continueCursor: string; isDone: boolean };

export async function listPublicMatches(cursor: string | null) {
  return await cachedRead(["public-matches", cursor ?? "start"], [appCacheTags.publicDiscovery()], async () => (await fetchQuery(listPublicMatchesReference, { paginationOpts: { cursor, numItems: 12 } })) as PublicPage<{
    eventId: string; name: string; gameEnd: string; clan: { id: string; name: string; avatar: string } | null;
    mapName: string; score: { axis: number; allied: number }; outcome?: string; category?: string;
  }>, 86400);
}

export async function searchPublicPlayers(term: string, cursor: string | null) {
  return await cachedRead(["public-player-search", term, cursor ?? "start"], [appCacheTags.publicDiscovery()], async () => (await fetchQuery(searchPublicPlayersReference, { term, paginationOpts: { cursor, numItems: 12 } })) as PublicPage<{ id: string; name: string; avatar: string }>, 86400);
}
