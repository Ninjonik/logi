import type { Client } from "discord.js";

import { revalidateAppData } from "../cache";
import { convex, references } from "../convex";
import { env } from "../environment";
import { logInfo, logWarn } from "../log";
import type { SyncPayload } from "../types";

export async function syncGuildMemberAccess(client: Client, payload: SyncPayload) {
  const guild = await client.guilds.fetch(payload.config.guildId).catch(() => null);
  if (!guild) {
    logWarn("member-access", "Skipping member access sync because guild could not be fetched", {
      guildId: payload.config.guildId,
    });
    return;
  }

  const members = await guild.members.fetch().catch(() => null);
  if (!members) {
    logWarn("member-access", "Skipping member access sync because members could not be fetched", {
      guildId: payload.config.guildId,
    });
    return;
  }

  logInfo("member-access", "Syncing guild member access", {
    guildId: payload.config.guildId,
    memberCount: members.size,
  });

  await convex.mutation(references.syncMemberAccess, {
    secret: env.internalSecret,
    guildId: payload.config.guildId,
    members: members.map((member) => {
      const roleIds = [...member.roles.cache.keys()].filter((roleId) => roleId !== guild.id);
      const isAdmin = member.permissions.has("Administrator");
      const hasDashboardAccess =
        isAdmin ||
        (payload.config.dashboardAdminRoleId ? roleIds.includes(payload.config.dashboardAdminRoleId) : false);

      return {
        userId: member.id,
        roleIds,
        voiceChannelId: member.voice.channelId ?? undefined,
        isAdmin,
        hasDashboardAccess,
      };
    }),
  });
  await revalidateAppData({
    type: "server-context-changed",
    serverId: payload.config.guildId,
  });
}
