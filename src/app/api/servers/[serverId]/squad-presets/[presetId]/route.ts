import { NextRequest, NextResponse } from "next/server";

import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags";
import { getUserSafeErrorMessage, logRouteError } from "@/lib/server-route-errors";
import { saveSquadPreset } from "@/lib/server-squad-presets";
import { squadPresetSchema } from "@/lib/validation/squad-preset";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ serverId: string; presetId: string }> },
) {
  try {
    const body = squadPresetSchema.parse(await request.json());
    const { serverId, presetId } = await params;
    const updatedPresetId = await saveSquadPreset({
      serverId,
      presetId,
      ...body,
    });

    revalidateCacheEntries([
      appCacheTags.serverContext(serverId),
      appCacheTags.squadPresets(serverId),
      appCacheTags.squadPreset(updatedPresetId),
    ]);

    return NextResponse.json({ presetId: updatedPresetId });
  } catch (error) {
    logRouteError("squadPresets.update", error);
    return NextResponse.json(
      { error: getUserSafeErrorMessage(error, "Unable to save the squad preset.") },
      { status: 400 },
    );
  }
}
