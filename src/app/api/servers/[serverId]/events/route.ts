import { NextRequest, NextResponse } from "next/server";

import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags";
import { getUserSafeErrorMessage, logRouteError } from "@/lib/server-route-errors";
import { importServerEventsFromLinks } from "@/lib/server-match-results";
import { saveServerEvent } from "@/lib/server-events";
import { eventSchema } from "@/lib/validation/event";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<unknown> },
) {
  try {
    const { serverId } = await params as { serverId: string };
    const rawBody = await request.json();

    if (rawBody?.action === "importEvents") {
      const result = await importServerEventsFromLinks({
        serverId,
        linksInput: String(rawBody.links ?? ""),
      });

      const importedEventIds = result.linkReports
        .map((report) => report.eventId)
        .filter((eventId): eventId is string => Boolean(eventId));
      revalidateCacheEntries([
        appCacheTags.serverContext(serverId),
        appCacheTags.events(serverId),
        appCacheTags.matches(serverId),
        ...importedEventIds.flatMap((eventId) => [
          appCacheTags.event(eventId),
          appCacheTags.match(eventId),
          appCacheTags.rosterImageEvent(eventId),
        ]),
        ...result.importedUserIds.flatMap((userId) => [
          appCacheTags.player(userId),
          appCacheTags.playerStats(userId),
          appCacheTags.users(),
        ]),
      ]);

      return NextResponse.json(result);
    }

    const body = eventSchema.parse(rawBody);
    const eventId = await saveServerEvent({
      serverId,
      ...body,
      topicPresetId: body.topicPresetId || undefined,
    });

    revalidateCacheEntries([
      appCacheTags.serverContext(serverId),
      appCacheTags.events(serverId),
      appCacheTags.event(eventId),
      appCacheTags.rosterImageEvent(eventId),
    ]);

    return NextResponse.json({ eventId });
  } catch (error) {
    logRouteError("events.create", error);
    return NextResponse.json(
      {
        error: getUserSafeErrorMessage(error, "Unable to save the event."),
      },
      { status: 400 },
    );
  }
}
