import { NextResponse } from "next/server";

import { getLoggedInUser, getVisibleGuildsForLoggedInUser, syncManagedGuildsForCurrentPlayer } from "@/lib/auth";
import { isBotInsideDiscordGuild } from "@/lib/discord";

export async function POST() {
  const user = await getLoggedInUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const visibleGuilds = await getVisibleGuildsForLoggedInUser();
    const managedGuilds = visibleGuilds.filter((guild) => user.managedGuildIds.includes(guild.id));

    await syncManagedGuildsForCurrentPlayer(
      user.id,
      await Promise.all(
        managedGuilds.map(async (guild) => ({
          id: guild.id,
          name: guild.name,
          avatar: guild.avatar,
          botInside: await isBotInsideDiscordGuild(guild.id),
        })),
      ),
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to refresh Discord bot status", error);
    return NextResponse.json({ error: "Unable to refresh Discord bot status." }, { status: 500 });
  }
}
