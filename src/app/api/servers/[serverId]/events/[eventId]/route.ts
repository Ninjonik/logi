import { NextRequest, NextResponse } from "next/server";

import { saveServerEvent } from "@/lib/server-events";
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
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to update event.",
      },
      { status: 400 },
    );
  }
}
