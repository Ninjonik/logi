import { NextRequest, NextResponse } from "next/server";

import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags";
import { getUserSafeErrorMessage, logRouteError } from "@/lib/server-route-errors";
import { saveSquadPreset } from "@/lib/server-squad-presets";
import { squadPresetSchema } from "@/lib/validation/squad-preset";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ serverId: string }> },
) {
  try {
    const body = squadPresetSchema.parse(await request.json());
    const { serverId } = await params;
    const presetId = await saveSquadPreset({
      serverId,
      ...body,
    });

    revalidateCacheEntries([
      appCacheTags.serverContext(serverId),
      appCacheTags.squadPresets(serverId),
      appCacheTags.squadPreset(presetId),
    ]);

    return NextResponse.json({ presetId });
  } catch (error) {
    logRouteError("squadPresets.create", error);
    return NextResponse.json(
      { error: getUserSafeErrorMessage(error, "Unable to save the squad preset.") },
      { status: 400 },
    );
  }
}
