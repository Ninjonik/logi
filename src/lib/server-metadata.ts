import { appCacheTags, tagCacheEntries } from "@/lib/cache-tags";
import { fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";

const getGuildByIdReference = makeFunctionReference<"query">("guilds:getById");
const getGuildByDiscordIdReference = makeFunctionReference<"query">("guilds:getByDiscordId");
const getEventByIdReference = makeFunctionReference<"query">("events:getById");
const getGroupByIdReference = makeFunctionReference<"query">("groups:getById");
const getRosterByIdReference = makeFunctionReference<"query">("serverMetadata:getRosterById");
const getSquadPresetByIdReference = makeFunctionReference<"query">("serverMetadata:getSquadPresetById");
const getTopicPresetByIdReference = makeFunctionReference<"query">("serverMetadata:getTopicPresetById");
const getAssignmentByIdReference = makeFunctionReference<"query">("userAssignments:getById");
const getPlayerByIdReference = makeFunctionReference<"query">("players:getById");
const getMatchByEventIdReference = makeFunctionReference<"query">("matchStats:getByEventId");

export async function getGuildMetadata(serverId: string) {
  "use cache";
  if (serverId.startsWith("sample-")) return null;
  tagCacheEntries([appCacheTags.server(serverId)]);
  return await fetchQuery(getGuildByIdReference, { guildId: serverId as never });
}

export async function getGuildMetadataByDiscordId(discordId: string) {
  "use cache";
  tagCacheEntries([appCacheTags.server(discordId)]);
  return await fetchQuery(getGuildByDiscordIdReference, { discordId });
}

export async function getEventMetadata(eventId: string) {
  "use cache";
  if (eventId.startsWith("sample-")) return null;
  tagCacheEntries([appCacheTags.event(eventId)]);
  return await fetchQuery(getEventByIdReference, { eventId: eventId as never });
}

export async function getGroupMetadata(groupId: string) {
  "use cache";
  if (groupId.startsWith("sample-")) return null;
  tagCacheEntries([appCacheTags.group(groupId)]);
  return await fetchQuery(getGroupByIdReference, { groupId: groupId as never });
}

export async function getRosterMetadata(rosterId: string) {
  "use cache";
  if (rosterId.startsWith("sample-")) return null;
  tagCacheEntries([appCacheTags.roster(rosterId)]);
  return await fetchQuery(getRosterByIdReference, { rosterId: rosterId as never });
}

export async function getSquadPresetMetadata(presetId: string) {
  "use cache";
  if (presetId.startsWith("sample-")) return null;
  tagCacheEntries([appCacheTags.squadPreset(presetId)]);
  return await fetchQuery(getSquadPresetByIdReference, { presetId: presetId as never });
}

export async function getTopicPresetMetadata(presetId: string) {
  "use cache";
  if (presetId.startsWith("sample-")) return null;
  tagCacheEntries([appCacheTags.topicPreset(presetId)]);
  return await fetchQuery(getTopicPresetByIdReference, { presetId: presetId as never });
}

export async function getAssignmentMetadata(assignmentId: string) {
  "use cache";
  if (assignmentId.startsWith("sample-")) return null;
  tagCacheEntries([appCacheTags.assignment(assignmentId)]);
  return await fetchQuery(getAssignmentByIdReference, { assignmentId: assignmentId as never });
}

export async function getPlayerMetadata(userId: string) {
  "use cache";
  tagCacheEntries([appCacheTags.player(userId), appCacheTags.users()]);
  return await fetchQuery(getPlayerByIdReference, { userId });
}

export async function getMatchMetadataByEventId(eventId: string) {
  "use cache";
  if (eventId.startsWith("sample-")) return null;
  tagCacheEntries([appCacheTags.match(eventId)]);
  return await fetchQuery(getMatchByEventIdReference, { eventId: eventId as never });
}
