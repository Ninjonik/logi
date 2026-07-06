import {
  getCurrentUser,
  getGuild,
  getGuildEvents,
  getGuildRosters,
  getGuildSquadPresets,
  getGuildTopicPresets,
  isGuildAdmin,
  mockGuilds,
} from "@/lib/mock-data";

export function getServerContext(serverId?: string) {
  const user = getCurrentUser();
  const server =
    (serverId ? getGuild(serverId) : undefined) ??
    (user.guildId ? getGuild(user.guildId) : undefined) ??
    mockGuilds[0];

  const canAdmin = server ? isGuildAdmin(server.id, user.id) : false;

  return {
    user,
    server,
    canAdmin,
    events: server ? getGuildEvents(server.id) : [],
    topicPresets: server ? getGuildTopicPresets(server.id) : [],
    squadPresets: server ? getGuildSquadPresets(server.id) : [],
    rosters: server ? getGuildRosters(server.id) : [],
  };
}
