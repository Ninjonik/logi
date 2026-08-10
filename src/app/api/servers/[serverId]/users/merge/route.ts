import { NextResponse } from "next/server";

import { handleIfNotLoggedIn } from "@/lib/auth";
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags";
import { getServerContext } from "@/lib/server-context";
import { mergeManagedUsers } from "@/lib/server-user-management";
import { logNextError, logNextInfo } from "@/lib/system-logs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ serverId: string }> },
) {
  const { serverId } = await params;
  await handleIfNotLoggedIn(`/dashboard/servers/${serverId}/users`);

  const context = await getServerContext(serverId);
  if (!context?.canAdmin) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const body = await request.json() as {
      primaryUserId?: string;
      secondaryUserId?: string;
    };

    const primaryUserId = String(body.primaryUserId ?? "").trim();
    const secondaryUserId = String(body.secondaryUserId ?? "").trim();

    if (!primaryUserId || !secondaryUserId) {
      return NextResponse.json({ error: "Pick both users." }, { status: 400 });
    }

    const result = await mergeManagedUsers({
      primaryUserId,
      secondaryUserId,
    });

    revalidateCacheEntries([
      appCacheTags.users(),
      appCacheTags.player(result.primaryUserId),
      appCacheTags.player(result.secondaryUserId),
      appCacheTags.playerStats(result.primaryUserId),
      appCacheTags.playerStats(result.secondaryUserId),
      appCacheTags.serverContext(serverId),
      appCacheTags.assignments(serverId),
      appCacheTags.events(serverId),
      appCacheTags.matches(serverId),
      appCacheTags.rosters(serverId),
      appCacheTags.rosterImage(),
      ...result.affectedServerIds.flatMap((affectedServerId) => [
        appCacheTags.serverContext(affectedServerId),
        appCacheTags.assignments(affectedServerId),
        appCacheTags.events(affectedServerId),
        appCacheTags.matches(affectedServerId),
        appCacheTags.rosters(affectedServerId),
      ]),
      ...result.touchedEventIds.map((eventId) => appCacheTags.event(eventId)),
      ...result.touchedEventIds.map((eventId) => appCacheTags.match(eventId)),
      ...result.touchedRosterIds.map((rosterId) => appCacheTags.roster(rosterId)),
    ]);

    logNextInfo("merge-users", "Merged two users", {
      serverId,
      userId: context.user.discordId,
      primaryUserId: result.primaryUserId,
      secondaryUserId: result.secondaryUserId,
    });

    return NextResponse.json(result);
  } catch (error) {
    logNextError("merge-users", "Failed to merge users", { serverId, error });
    return NextResponse.json({ error: "Unable to merge users." }, { status: 500 });
  }
}
