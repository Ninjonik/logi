import { NextRequest, NextResponse } from "next/server";

import { getUserSafeErrorMessage, logRouteError } from "@/lib/server-route-errors";
import { saveTopicPreset } from "@/lib/server-topic-presets";
import { topicPresetSchema } from "@/lib/validation/topic-preset";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ serverId: string }> },
) {
  try {
    const body = topicPresetSchema.parse(await request.json());
    const { serverId } = await params;
    const presetId = await saveTopicPreset({
      serverId,
      ...body,
    });

    return NextResponse.json({ presetId });
  } catch (error) {
    logRouteError("topicPresets.create", error);
    return NextResponse.json(
      { error: getUserSafeErrorMessage(error, "Unable to save the topic preset.") },
      { status: 400 },
    );
  }
}
