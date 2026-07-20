import { NextResponse } from "next/server";

import { handleIfNotLoggedIn } from "@/lib/auth";
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags";
import { getServerContext } from "@/lib/server-context";
import { saveGuildFrontendSettings } from "@/lib/server-guild-settings";

export async function POST(request: Request, context: { params: Promise<{ serverId: string }> }) {
  const { serverId } = await context.params;
  await handleIfNotLoggedIn(`/dashboard/servers/${serverId}/settings`);

  const serverContext = await getServerContext(serverId);
  if (!serverContext?.canAdmin) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      name?: string;
      avatar?: string;
      description?: string;
      rosterScoreSettings?: {
        noResponse?: number;
        declined?: number;
        accepted?: number;
      };
    };

    if (!body.name?.trim() || !body.avatar?.trim()) {
      return NextResponse.json({ error: "Name and avatar are required." }, { status: 400 });
    }

    const rosterScoreSettings = {
      noResponse: body.rosterScoreSettings?.noResponse,
      declined: body.rosterScoreSettings?.declined,
      accepted: body.rosterScoreSettings?.accepted,
    };

    if (!Object.values(rosterScoreSettings).every(Number.isInteger)) {
      return NextResponse.json({ error: "Roster score settings must be integers." }, { status: 400 });
    }

    await saveGuildFrontendSettings({
      guildId: serverId,
      name: body.name,
      avatar: body.avatar,
      description: body.description,
      rosterScoreSettings: rosterScoreSettings as {
        noResponse: number;
        declined: number;
        accepted: number;
      },
    });

    revalidateCacheEntries([
      appCacheTags.server(serverId),
      appCacheTags.serverContext(serverId),
      appCacheTags.rosters(serverId),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to save guild frontend settings", error);
    return NextResponse.json({ error: "Unable to save clan frontend settings." }, { status: 500 });
  }
}
