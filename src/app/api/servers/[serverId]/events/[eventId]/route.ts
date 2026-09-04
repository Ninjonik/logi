import { NextRequest, NextResponse } from "next/server";

import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags";
import { getClanDiscordMessages } from "@/lib/clan-language";
import { sendDiscordBotDm, syncDiscordMemberRoleIds } from "@/lib/discord";
import { getUserSafeErrorMessage, logRouteError } from "@/lib/server-route-errors";
import { getDiscordConfigByGuild } from "@/lib/server-discord-settings";
import { completeServerTraining, concludeServerEvent, saveServerEvent } from "@/lib/server-events";
import { importEventMatchResults } from "@/lib/server-match-results";
import { createServerEventPatchHandler, createServerEventPostHandler } from "@/lib/api/event-route-handlers";
import { eventSchema } from "@/lib/validation/event";
import { getEventMetadata, getGuildMetadata } from "@/lib/server-metadata";
import { getUsersByIds } from "@/lib/server-user-management";

const patchHandler = createServerEventPatchHandler({
  eventSchema,
  saveServerEvent,
  concludeServerEvent,
  completeServerTraining,
  importServerEventsFromLinks: async () => { throw new Error("Unused."); },
  importEventMatchResults,
  getEventMetadata,
  finalizeTrainingCompletion: async () => undefined,
  revalidateCacheEntries,
  appCacheTags,
  logRouteError,
  getUserSafeErrorMessage,
});

const postHandler = createServerEventPostHandler({
  eventSchema,
  saveServerEvent,
  concludeServerEvent,
  completeServerTraining,
  importServerEventsFromLinks: async () => { throw new Error("Unused."); },
  importEventMatchResults,
  getEventMetadata,
  finalizeTrainingCompletion: async ({ serverId, eventId, participants }) => {
    const [event, guild, discordConfig] = await Promise.all([
      getEventMetadata(eventId),
      getGuildMetadata(serverId),
      getDiscordConfigByGuild(serverId),
    ]);

    if (!event || !guild) {
      return;
    }

    const users = await getUsersByIds(participants.map((participant) => participant.userId), guild.discordId);

    const messages = getClanDiscordMessages(discordConfig?.defaultLanguage);
    const rewardRoleIds = event.rewardRoleIds ?? [];
    const userByDiscordId = new Map(users.map((user) => [user.discordId, user]));
    const rewardedUserIds: string[] = [];
    const dmSentUserIds: string[] = [];

    await Promise.all(participants.map(async (participant) => {
      if (participant.completed === "passed" && rewardRoleIds.length > 0) {
        await syncDiscordMemberRoleIds({
          discordGuildId: guild.discordId,
          userId: participant.userId,
          addRoleIds: rewardRoleIds,
        });
        rewardedUserIds.push(participant.userId);
      }

      const user = userByDiscordId.get(participant.userId);
      const displayName = user?.name ?? participant.userId;
      const statusLabel = participant.completed === "passed"
        ? messages.training.resultPassed
        : messages.training.resultFailed;
      const roleLine = participant.completed === "passed" && rewardRoleIds.length > 0
        ? ` ${messages.training.rewardGranted}`
        : "";

      try {
        await sendDiscordBotDm(
          participant.userId,
          messages.training.dmResult
            .replace("{name}", displayName)
            .replace("{event}", event.name ?? "training")
            .replace("{result}", statusLabel)
            .replace("{reward}", roleLine),
        );
        dmSentUserIds.push(participant.userId);
      } catch {
        // Ignore DM failures so the training completion flow still succeeds.
      }
    }));

    return {
      rewardedUserIds,
      dmSentUserIds,
    };
  },
  revalidateCacheEntries,
  appCacheTags,
  logRouteError,
  getUserSafeErrorMessage,
});

export async function PATCH(request: Request, context: { params: Promise<{ serverId: string; eventId: string }> }) {
  return patchHandler(request, context);
}

export async function POST(request: Request, context: { params: Promise<{ serverId: string; eventId: string }> }) {
  return postHandler(request, context);
}
