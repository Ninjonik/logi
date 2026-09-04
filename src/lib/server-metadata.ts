import { appCacheTags, cachedRead } from "@/lib/cache-tags";
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
  if (serverId.startsWith("sample-")) return null;
  // Session-only Discord guild entries use the Discord snowflake as their route
  // identifier. Resolve those safely instead of passing them to v.id("guilds").
  if (/^\d{17,20}$/.test(serverId)) {
    return await getGuildMetadataByDiscordId(serverId);
  }
  return await cachedRead(["guild", serverId], [appCacheTags.server(serverId)], () => fetchQuery(getGuildByIdReference, { guildId: serverId as never }));
}

export async function getGuildMetadataByDiscordId(discordId: string) {
  return await cachedRead(["guild-discord", discordId], [appCacheTags.server(discordId)], () => fetchQuery(getGuildByDiscordIdReference, { discordId }));
}

export async function getEventMetadata(eventId: string) {
  if (eventId.startsWith("sample-")) return null;
  return await cachedRead(["event", eventId], [appCacheTags.event(eventId)], () => fetchQuery(getEventByIdReference, { eventId: eventId as never }));
}

export async function getGroupMetadata(groupId: string) {
  if (groupId.startsWith("sample-")) return null;
  return await cachedRead(["group", groupId], [appCacheTags.group(groupId)], () => fetchQuery(getGroupByIdReference, { groupId: groupId as never }));
}

export async function getRosterMetadata(rosterId: string) {
  if (rosterId.startsWith("sample-")) return null;
  return await cachedRead(["roster", rosterId], [appCacheTags.roster(rosterId)], () => fetchQuery(getRosterByIdReference, { rosterId: rosterId as never }));
}

export async function getSquadPresetMetadata(presetId: string) {
  if (presetId.startsWith("sample-")) return null;
  return await cachedRead(["squad-preset", presetId], [appCacheTags.squadPreset(presetId)], () => fetchQuery(getSquadPresetByIdReference, { presetId: presetId as never }));
}

export async function getTopicPresetMetadata(presetId: string) {
  if (presetId.startsWith("sample-")) return null;
  return await cachedRead(["topic-preset", presetId], [appCacheTags.topicPreset(presetId)], () => fetchQuery(getTopicPresetByIdReference, { presetId: presetId as never }));
}

export async function getAssignmentMetadata(assignmentId: string) {
  if (assignmentId.startsWith("sample-")) return null;
  return await cachedRead(["assignment", assignmentId], [appCacheTags.assignment(assignmentId)], () => fetchQuery(getAssignmentByIdReference, { assignmentId: assignmentId as never }));
}

export async function getPlayerMetadata(userId: string) {
  return await cachedRead(["player", userId], [appCacheTags.player(userId), appCacheTags.users()], () => fetchQuery(getPlayerByIdReference, { userId }));
}

export async function getMatchMetadataByEventId(eventId: string) {
  if (eventId.startsWith("sample-")) return null;
  return await cachedRead(["match", eventId], [appCacheTags.match(eventId)], () => fetchQuery(getMatchByEventIdReference, { eventId: eventId as never }));
}
