import { NextResponse } from "next/server";

import { handleIfNotLoggedIn } from "@/lib/auth";
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags";
import { fetchDiscordGuildMembers, getDiscordAvatarUrl, type DiscordGuildMember } from "@/lib/discord";
import { getPlayerStatsUserIdsForEvents } from "@/lib/server-player-stats";
import { linkMissingDiscordIdsFromRole } from "@/lib/server-match-results";
import { getServerContext } from "@/lib/server-context";

function getDisplayName(member: DiscordGuildMember) {
  return member.nick?.trim() || member.user?.global_name?.trim() || member.user?.username?.trim() || member.user?.id || "Unknown";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ serverId: string }> },
) {
  const { serverId } = await params;
  await handleIfNotLoggedIn(`/dashboard/servers/${serverId}/settings`);

  const context = await getServerContext(serverId);
  if (!context?.canAdmin) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const body = await request.json() as { roleId?: string };
    const roleId = String(body.roleId ?? "").trim();

    if (!roleId) {
      return NextResponse.json({ error: "Role is required." }, { status: 400 });
    }

    const [discordMembers, serverUserIds] = await Promise.all([
      fetchDiscordGuildMembers(context.server.discordId),
      getPlayerStatsUserIdsForEvents(context.events.map((event) => event.id)),
    ]);

    const roleMembers = discordMembers.flatMap((member) => {
      if (!member.user || member.user.bot || !member.roles.includes(roleId)) {
        return [];
      }

      return [{
        discordId: member.user.id,
        name: getDisplayName(member),
        avatar: getDiscordAvatarUrl({
          id: member.user.id,
          username: member.user.username,
          avatar: member.user.avatar,
        }),
      }];
    });

    const result = await linkMissingDiscordIdsFromRole({
      serverUserIds,
      roleMembers,
    });

    revalidateCacheEntries([
      appCacheTags.users(),
      ...result.linkedUserIds.flatMap((userId) => [
        appCacheTags.player(userId),
        appCacheTags.playerStats(userId),
      ]),
    ]);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to link missing Discord IDs", error);
    return NextResponse.json({ error: "Unable to link missing Discord IDs." }, { status: 500 });
  }
}
