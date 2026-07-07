import { NextRequest, NextResponse } from "next/server";

import { getUserSafeErrorMessage, logRouteError } from "@/lib/server-route-errors";
import { saveServerEvent } from "@/lib/server-events";
import { eventSchema } from "@/lib/validation/event";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<unknown> },
) {
  try {
    const body = eventSchema.parse(await request.json());
    const { serverId } = await params as { serverId: string };
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
