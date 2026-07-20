import { cacheTag, revalidateTag } from "next/cache";

export const appCacheTags = {
  server: (serverId: string) => `server:${serverId}`,
  serverContext: (serverId: string) => `server-context:${serverId}`,
  events: (serverId: string) => `events:${serverId}`,
  event: (eventId: string) => `event:${eventId}`,
  matches: (serverId: string) => `matches:${serverId}`,
  match: (eventId: string) => `match:${eventId}`,
  rosters: (serverId: string) => `rosters:${serverId}`,
  roster: (rosterId: string) => `roster:${rosterId}`,
  groups: (serverId: string) => `groups:${serverId}`,
  group: (groupId: string) => `group:${groupId}`,
  assignments: (serverId: string) => `assignments:${serverId}`,
  assignment: (assignmentId: string) => `assignment:${assignmentId}`,
  topicPresets: (serverId: string) => `topic-presets:${serverId}`,
  topicPreset: (presetId: string) => `topic-preset:${presetId}`,
  squadPresets: (serverId: string) => `squad-presets:${serverId}`,
  squadPreset: (presetId: string) => `squad-preset:${presetId}`,
  discordConfig: (serverId: string) => `discord-config:${serverId}`,
  users: () => "users",
  player: (userId: string) => `player:${userId}`,
  playerStats: (userId: string) => `player-stats:${userId}`,
  rosterImage: () => "roster-image:v3",
  rosterImageEvent: (eventId: string) => `roster-image:v3:${eventId}`,
} as const;

export function tagCacheEntries(tags: Array<string | null | undefined | false>) {
  const uniqueTags = [...new Set(tags.filter((tag): tag is string => Boolean(tag)))];
  uniqueTags.forEach((tag) => cacheTag(tag));
}

export function revalidateCacheEntries(tags: Array<string | null | undefined | false>) {
  const uniqueTags = [...new Set(tags.filter((tag): tag is string => Boolean(tag)))];
  uniqueTags.forEach((tag) => revalidateTag(tag, "max"));
}
