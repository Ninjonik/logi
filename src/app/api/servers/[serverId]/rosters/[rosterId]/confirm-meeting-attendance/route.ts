import { NextResponse } from "next/server";

import { handleIfNotLoggedIn } from "@/lib/auth";
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags";
import { confirmRosterAttendanceFromMeetingChannel } from "@/lib/server-discord-settings";
import { getServerContext } from "@/lib/server-context";
import { getDiscordBotToken } from "@/lib/env";
import { logNextError, logNextInfo } from "@/lib/system-logs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ serverId: string; rosterId: string }> },
) {
  const { serverId, rosterId } = await context.params;
  await handleIfNotLoggedIn(`/dashboard/servers/${serverId}/rosters/${rosterId}`);

  const serverContext = await getServerContext(serverId);
  if (!serverContext?.canAdmin) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const roster = serverContext.rosters.find((item) => item.id === rosterId);
    const meetingChannelId = serverContext.discordConfig?.meetingChannelId;
    if (!roster || !meetingChannelId) throw new Error("Meeting channel is not configured.");
    const candidateIds = [...new Set([
      ...roster.reservePlayerIds,
      ...roster.squads.flatMap((squad) => squad.players.map((player) => player.id).filter((id): id is string => Boolean(id))),
    ])];
    const token = getDiscordBotToken();
    const voiceStates = await Promise.all(candidateIds.map(async (userId) => {
      const response = await fetch(`https://discord.com/api/v10/guilds/${serverContext.server.discordId}/voice-states/${userId}`, { headers: { Authorization: `Bot ${token}` }, cache: "no-store" });
      if (!response.ok) return null;
      return await response.json() as { channel_id?: string | null };
    }));
    const result = await confirmRosterAttendanceFromMeetingChannel({
      guildId: serverContext.server.discordId,
      rosterId,
      memberIdsInMeetingChannel: candidateIds.filter((_, index) => voiceStates[index]?.channel_id === meetingChannelId),
    });

    revalidateCacheEntries([
      appCacheTags.serverContext(serverId),
      appCacheTags.rosters(serverId),
      appCacheTags.roster(rosterId),
      roster?.eventId ? appCacheTags.rosterImageEvent(roster.eventId) : undefined,
    ]);

    logNextInfo("confirm-meeting-attendance", "Confirmed roster attendance from meeting channel", {
      serverId,
      rosterId,
      userId: serverContext.user.discordId,
    });
    return NextResponse.json(result);
  } catch (error) {
    logNextError("confirm-meeting-attendance", "Failed to confirm meeting attendance", {
      serverId,
      rosterId,
      error,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to confirm attendance." },
      { status: 500 },
    );
  }
}
