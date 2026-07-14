import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

import { getUserSafeErrorMessage, logRouteError } from "@/lib/server-route-errors";
import { concludeServerEvent, saveServerEvent } from "@/lib/server-events";
import { importEventMatchResults } from "@/lib/server-match-results";
import { eventSchema } from "@/lib/validation/event";
import { getEventMetadata } from "@/lib/server-metadata";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<unknown> },
) {
  try {
    const body = eventSchema.parse(await request.json());
    const { serverId, eventId } = await params as { serverId: string; eventId: string };
    const updatedEventId = await saveServerEvent({
      eventId,
      serverId,
      ...body,
      topicPresetId: body.topicPresetId || undefined,
    });

    return NextResponse.json({ eventId: updatedEventId });
  } catch (error) {
    logRouteError("events.update", error);
    return NextResponse.json(
      {
        error: getUserSafeErrorMessage(error, "Unable to save the event."),
      },
      { status: 400 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<unknown> },
) {
  try {
    const body = await request.json();
    const { serverId, eventId } = await params as { serverId: string; eventId: string };

    if (body?.action === "conclude") {
      await concludeServerEvent({ eventId });
      return NextResponse.json({ ok: true });
    }

    if (body?.action === "submitMatchResults") {
      const event = await getEventMetadata(eventId);
      if (!event) {
        return NextResponse.json({ error: "Event not found." }, { status: 404 });
      }

      const result = await importEventMatchResults({
        serverId,
        eventId,
        eventSide: event.side,
        matchLink: String(body.matchLink ?? ""),
      });

      result.importedUserIds.forEach((userId) => {
        revalidateTag(`player-stats:${userId}`, "max");
      });
      return NextResponse.json(result);
    }

    if (body?.action !== "conclude") {
      return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
    }
  } catch (error) {
    logRouteError("events.conclude", error);
    return NextResponse.json(
      {
        error: getUserSafeErrorMessage(error, "Unable to process the event action."),
      },
      { status: 400 },
    );
  }
}
