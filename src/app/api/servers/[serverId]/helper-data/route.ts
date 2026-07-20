import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags";
import { initializeDefaultHelperData, resetHelperData } from "@/lib/server-setup";

const helperDataActionSchema = z.object({
  action: z.enum(["initialize", "reset"]),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ serverId: string }> },
) {
  try {
    const body = helperDataActionSchema.parse(await request.json());
    const { serverId } = await params;

    if (body.action === "initialize") {
      await initializeDefaultHelperData(serverId);
    } else {
      await resetHelperData(serverId);
    }

    revalidateCacheEntries([
      appCacheTags.serverContext(serverId),
      appCacheTags.groups(serverId),
      appCacheTags.topicPresets(serverId),
      appCacheTags.squadPresets(serverId),
      appCacheTags.rosterImage(),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating helper data: ", error, "");
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to update helper data.",
      },
      { status: 400 },
    );
  }
}
