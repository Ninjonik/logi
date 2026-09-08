import { NextRequest, NextResponse } from "next/server";

import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags";
import { getServerContext } from "@/lib/server-context";
import { getUserSafeErrorMessage, logRouteError } from "@/lib/server-route-errors";
import { deleteDraftRoster } from "@/lib/server-rosters";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ serverId: string; rosterId: string }> },
) {
  try {
    const { serverId, rosterId } = await params;
    const context = await getServerContext(serverId);
    if (!context?.canAdmin) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const roster = context.rosters.find((item) => item.id === rosterId);
    if (!roster) {
      return NextResponse.json({ error: "Roster not found." }, { status: 404 });
    }
    if (roster.published) {
      return NextResponse.json({ error: "Published rosters cannot be deleted." }, { status: 400 });
    }

    await deleteDraftRoster(rosterId);
    revalidateCacheEntries([
      appCacheTags.serverContext(serverId),
      appCacheTags.roster(rosterId),
      appCacheTags.rosters(serverId),
      appCacheTags.event(roster.eventId),
      appCacheTags.events(serverId),
      appCacheTags.rosterImage(),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    logRouteError("rosters.delete", error);
    return NextResponse.json(
      { error: getUserSafeErrorMessage(error, "Unable to delete the roster.") },
      { status: 400 },
    );
  }
}
