import { NextResponse } from "next/server";

import { handleIfNotLoggedIn } from "@/lib/auth";
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags";
import { getServerContext } from "@/lib/server-context";
import { saveDiscordConfig } from "@/lib/server-discord-settings";
import { discordSettingsSchema } from "@/lib/validation/discord-settings";

export async function POST(request: Request, context: { params: Promise<{ serverId: string }> }) {
  const { serverId } = await context.params;
  await handleIfNotLoggedIn(`/dashboard/servers/${serverId}/settings`);

  const serverContext = await getServerContext(serverId);
  if (!serverContext?.canAdmin) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const json = await request.json();
    const parsed = discordSettingsSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Invalid Discord settings.",
        },
        { status: 400 },
      );
    }

    await saveDiscordConfig({
      guildId: serverId,
      ...parsed.data,
    });

    revalidateCacheEntries([
      appCacheTags.serverContext(serverId),
      appCacheTags.discordConfig(serverId),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to save Discord settings", error);
    return NextResponse.json({ error: "Unable to save Discord settings." }, { status: 500 });
  }
}
