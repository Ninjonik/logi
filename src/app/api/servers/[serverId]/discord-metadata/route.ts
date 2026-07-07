import { NextResponse } from "next/server";

import { handleIfNotLoggedIn } from "@/lib/auth";
import { fetchDiscordGuildChannels, fetchDiscordGuildEmojis, fetchDiscordGuildRoles } from "@/lib/discord";
import { getServerContext } from "@/lib/server-context";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ serverId: string }> },
) {
  const { serverId } = await params;
  await handleIfNotLoggedIn(`/dashboard/servers/${serverId}/settings`);

  const context = await getServerContext(serverId);
  if (!context?.canAdmin) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const [roles, channels, emojis] = await Promise.all([
      fetchDiscordGuildRoles(serverId),
      fetchDiscordGuildChannels(serverId),
      fetchDiscordGuildEmojis(serverId),
    ]);

    return NextResponse.json({
      roles: roles
        .filter((role) => role.name !== "@everyone")
        .sort((a, b) => b.position - a.position)
        .map((role) => ({
          id: role.id,
          name: role.name,
        })),
      channels: channels.map((channel) => ({
        id: channel.id,
        name: channel.name,
        type: channel.type,
        parentId: channel.parent_id ?? undefined,
      })),
      emojis: emojis
        .filter((emoji) => emoji.id && emoji.name)
        .map((emoji) => ({
          id: `<${emoji.animated ? "a" : ""}:${emoji.name!}:${emoji.id!}>`,
          name: emoji.name!,
          imageUrl: emoji.id
            ? `https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? "gif" : "png"}?size=64`
            : undefined,
          value: emoji.id && emoji.name ? `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}>` : emoji.name!,
        })),
    });
  } catch (error) {
    console.error("Failed to fetch Discord guild metadata", error);
    return NextResponse.json({ error: "Unable to load Discord metadata." }, { status: 500 });
  }
}
