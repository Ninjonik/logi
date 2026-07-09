import { NextRequest, NextResponse } from "next/server";

import { getUserSafeErrorMessage, logRouteError } from "@/lib/server-route-errors";
import { concludeServerEvent, saveServerEvent } from "@/lib/server-events";
import { eventSchema } from "@/lib/validation/event";

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
    if (body?.action !== "conclude") {
      return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
    }

    const { eventId } = await params as { serverId: string; eventId: string };
    await concludeServerEvent({ eventId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logRouteError("events.conclude", error);
    return NextResponse.json(
      {
        error: getUserSafeErrorMessage(error, "Unable to conclude the event."),
      },
      { status: 400 },
    );
  }
}
