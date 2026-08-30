import { NextRequest, NextResponse } from "next/server";
import { fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";

import { getClanDiscordMessages } from "@/lib/clan-language";
import { sendDiscordBotDm } from "@/lib/discord";
import { getDiscordBotToken } from "@/lib/env";
import { getInternalAuthSecret } from "@/lib/env";
import { summarizeRosterUpdates } from "@/lib/roster-update-summary";
import { getDiscordConfigByGuild } from "@/lib/server-discord-settings";
import { getEventMetadata, getGuildMetadata } from "@/lib/server-metadata";
import { getUsersByIds } from "@/lib/server-user-management";
import type { Roster } from "@/types/domain";

const getEventSyncContextReference = makeFunctionReference<"query">("discordSync:getEventSyncContext");

type UpdateNotificationBody = {
  previousRoster: Roster;
  nextRoster: Roster;
  postAnnouncement?: boolean;
  notifyPlayers?: boolean;
};

async function postDiscordChannelMessage(channelId: string, content: string) {
  const botToken = getDiscordBotToken();
  if (!botToken) {
    throw new Error("Discord bot token is missing.");
  }

  const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${botToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ content }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to post roster update message to Discord.");
  }
}

function formatAnnouncementMessage(input: {
  eventName: string;
  messages: ReturnType<typeof getClanDiscordMessages>;
  summary: ReturnType<typeof summarizeRosterUpdates>;
  rosterUrl?: string;
}) {
  const lines = [
    `📋 **${input.messages.rosterUpdate.announcementTitle}**`,
  ];

  if (input.summary.addedLines.length) {
    lines.push("", `🟢 **${input.messages.rosterUpdate.addedLabel}**`, ...input.summary.addedLines);
  }
  if (input.summary.removedLines.length) {
    lines.push("", `🔴 **${input.messages.rosterUpdate.removedLabel}**`, ...input.summary.removedLines);
  }
  if (input.summary.movedLines.length) {
    lines.push("", `🔁 **${input.messages.rosterUpdate.movedLabel}**`, ...input.summary.movedLines);
  }
  if (input.summary.roleChangedLines.length) {
    lines.push("", `🔄 **${input.messages.rosterUpdate.roleChangedLabel}**`, ...input.summary.roleChangedLines);
  }

  return lines.join("\n").slice(0, 1900);
}

function formatDmMessage(input: {
  eventName: string;
  playerName: string;
  messages: ReturnType<typeof getClanDiscordMessages>;
  userId: string;
  summary: ReturnType<typeof summarizeRosterUpdates>;
  rosterUrl?: string;
}) {
  const lines = [
    input.messages.rosterUpdate.dmIntro
      .replace("{name}", input.playerName)
      .replace("{event}", input.eventName),
  ];

  if (input.summary.addedUserIds.includes(input.userId)) {
    lines.push(input.messages.rosterUpdate.dmAdded);
  }
  if (input.summary.removedUserIds.includes(input.userId)) {
    lines.push(input.messages.rosterUpdate.dmRemoved);
  }
  if (input.summary.movedUserIds.includes(input.userId)) {
    lines.push(input.messages.rosterUpdate.dmMoved);
  }
  if (input.summary.roleChangedUserIds.includes(input.userId)) {
    const change = input.summary.roleChanges[input.userId];
    lines.push(`${input.messages.rosterUpdate.dmRoleChanged}: ${change?.previous ?? "Unassigned"} → ${change?.next ?? "Unassigned"}`);
  }

  if (input.rosterUrl) lines.push("", input.rosterUrl);

  return lines.join("\n");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ serverId: string; rosterId: string }> },
) {
  const { serverId } = await params;
  const body = await request.json() as UpdateNotificationBody;

  const [guild, event, discordConfig] = await Promise.all([
    getGuildMetadata(serverId),
    getEventMetadata(body.nextRoster.eventId),
    getDiscordConfigByGuild(serverId),
  ]);

  if (!guild || !event) {
    return NextResponse.json({ error: "Roster context not found." }, { status: 404 });
  }

  const changedUserIds = [...new Set([
    ...body.previousRoster.squads.flatMap((squad) => squad.players.map((player) => player.id).filter(Boolean) as string[]),
    ...body.nextRoster.squads.flatMap((squad) => squad.players.map((player) => player.id).filter(Boolean) as string[]),
  ])];
  const users = await getUsersByIds(changedUserIds, guild.discordId);
  const summary = summarizeRosterUpdates(body.previousRoster, body.nextRoster, users);

  if (!summary.hasChanges) {
    return NextResponse.json({ ok: true, hasChanges: false, dmSentUserIds: [] });
  }

  const messages = getClanDiscordMessages(discordConfig?.defaultLanguage);
  // The roster link is useful context, but a temporary Convex read failure must
  // never prevent the actual DM notification from being sent.
  const syncContext = await fetchQuery(getEventSyncContextReference, {
    secret: getInternalAuthSecret(),
    eventId: event.id as never,
  }).catch(() => null) as { syncState: { eventInfoMessageId?: string; announcementMessageId?: string } | null } | null;
  const rosterMessageId = syncContext?.syncState?.eventInfoMessageId ?? syncContext?.syncState?.announcementMessageId;
  const rosterChannelId = syncContext?.syncState?.eventInfoMessageId ? discordConfig?.eventInfoChannelId : discordConfig?.announcementsChannelId;
  const rosterUrl = rosterChannelId && rosterMessageId ? `https://discord.com/channels/${guild.discordId}/${rosterChannelId}/${rosterMessageId}` : undefined;
  const changedRecipients = [...new Set([
    ...summary.addedUserIds,
    ...summary.removedUserIds,
    ...summary.movedUserIds,
    ...summary.roleChangedUserIds,
  ])];
  const usersById = new Map(users.map((user) => [user.discordId, user]));
  const dmSentUserIds: string[] = [];
  const dmFailedUserIds: string[] = [];

  if (body.notifyPlayers !== false) await Promise.all(changedRecipients.map(async (userId) => {
    const user = usersById.get(userId);

    try {
      await sendDiscordBotDm(userId, formatDmMessage({
        eventName: event.name,
        playerName: user?.name ?? userId,
        messages,
        userId,
        summary,
        rosterUrl,
      }));
      dmSentUserIds.push(userId);
    } catch {
      dmFailedUserIds.push(userId);
    }
  }));

  const rosterUpdateChannelId = discordConfig?.eventInfoChannelId ?? discordConfig?.announcementsChannelId;
  if (body.postAnnouncement && rosterUpdateChannelId) {
    await postDiscordChannelMessage(
      rosterUpdateChannelId,
      formatAnnouncementMessage({
        eventName: event.name,
        messages,
        summary,
      }),
    );
  }

  return NextResponse.json({
    ok: true,
    hasChanges: true,
    dmSentUserIds,
    dmFailedUserIds,
    postedAnnouncement: Boolean(body.postAnnouncement && rosterUpdateChannelId),
  });
}
