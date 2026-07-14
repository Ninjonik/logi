import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

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

      result.importedUserIds.forEach((userId) => {
        revalidateTag(`player-stats:${userId}`, "max");
      });

      return NextResponse.json(result);
    }

    const body = eventSchema.parse(rawBody);
    const eventId = await saveServerEvent({
      serverId,
      ...body,
      topicPresetId: body.topicPresetId || undefined,
    });

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
