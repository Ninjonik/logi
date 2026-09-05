import { revalidateTag, unstable_cache } from "next/cache";

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
  stratmaps: (serverId: string) => `stratmaps:${serverId}`,
  stratmap: (stratmapId: string) => `stratmap:${stratmapId}`,
  discordConfig: (serverId: string) => `discord-config:${serverId}`,
  users: () => "users",
  player: (userId: string) => `player:${userId}`,
  playerStats: (userId: string) => `player-stats:${userId}`,
  publicProfile: (userId: string) => `public-profile:${userId}`,
  publicClan: (guildId: string) => `public-clan:${guildId}`,
  publicMatch: (eventId: string) => `public-match:${eventId}`,
  publicDiscovery: () => "public-discovery",
  competition: (slug: string) => `competition:${slug}`,
  rosterImage: () => "roster-image:v3",
  rosterImageEvent: (eventId: string) => `roster-image:v3:${eventId}`,
} as const;

export function cachedRead<T>(
  keyParts: string[],
  tags: Array<string | null | undefined | false>,
  read: () => Promise<T>,
  revalidate = 3600,
) {
  const uniqueTags = [...new Set(tags.filter((tag): tag is string => Boolean(tag)))];
  return unstable_cache(read, keyParts, { tags: uniqueTags, revalidate })();
}

export function revalidateCacheEntries(tags: Array<string | null | undefined | false>) {
  const uniqueTags = [...new Set(tags.filter((tag): tag is string => Boolean(tag)))];
  uniqueTags.forEach((tag) => revalidateTag(tag, { expire: 0 }));
}
