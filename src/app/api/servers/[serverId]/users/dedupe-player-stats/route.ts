import { NextResponse } from "next/server";

import { handleIfNotLoggedIn } from "@/lib/auth";
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags";
import { getServerContext } from "@/lib/server-context";
import { dedupePlayerStatsForEvents } from "@/lib/server-player-stats";
import { logNextError, logNextInfo } from "@/lib/system-logs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ serverId: string }> },
) {
  const { serverId } = await params;
  await handleIfNotLoggedIn(`/dashboard/servers/${serverId}/settings`);

  const context = await getServerContext(serverId);
  if (!context?.canAdmin) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const eventIds = context.events.map((event) => event.id);
    const result = await dedupePlayerStatsForEvents(eventIds);

    revalidateCacheEntries([
      appCacheTags.serverContext(serverId),
      appCacheTags.events(serverId),
      appCacheTags.matches(serverId),
      ...eventIds.map((eventId) => appCacheTags.event(eventId)),
      ...eventIds.map((eventId) => appCacheTags.match(eventId)),
      ...result.affectedUserIds.map((userId) => appCacheTags.player(userId)),
      ...result.affectedUserIds.map((userId) => appCacheTags.playerStats(userId)),
    ]);

    logNextInfo("dedupe-player-stats", "Deduped player stats for server events", {
      serverId,
      userId: context.user.discordId,
      eventCount: eventIds.length,
      duplicateMatchesRemoved: result.duplicateMatchesRemoved,
      docsDeleted: result.docsDeleted,
      docsPatched: result.docsPatched,
      affectedUsers: result.affectedUserIds.length,
    });

    return NextResponse.json(result);
  } catch (error) {
    logNextError("dedupe-player-stats", "Failed to dedupe player stats", { serverId, error });
    return NextResponse.json({ error: "Unable to dedupe player stats." }, { status: 500 });
  }
}
