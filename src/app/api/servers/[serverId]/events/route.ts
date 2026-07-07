import { NextRequest, NextResponse } from "next/server";

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
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to save event.",
      },
      { status: 400 },
    );
  }
}
