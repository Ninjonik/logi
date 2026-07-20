import { Events } from "discord.js";
import { Worker } from "node:worker_threads";

import { client } from "./discord-client";
import { env } from "./environment";
import { createInteractionHandler } from "./interactions";
import { logError, logInfo, logWarn } from "./log";
import { DiscordSyncService } from "./runtime/sync-service";

const syncService = new DiscordSyncService(client);

function triggerPollSoon() {
  logInfo("bot", "Requested near-term sync flush");
  syncService.triggerSoon();
}

const interactionHandler = createInteractionHandler({
  enqueueEventSync: (eventId) => syncService.queueEventSync(eventId),
  triggerPollSoon,
});

function startFallbackWorker() {
  const fallbackWorker = new Worker(new URL("./runtime/fallback-worker.ts", import.meta.url), {
    execArgv: process.execArgv,
  });

  fallbackWorker.on("message", (message: { type: string; eventIds?: string[]; error?: string }) => {
    if (message.type === "eventsChanged") {
      logInfo("fallback-worker", "Received changed events", {
        eventIds: message.eventIds ?? [],
        count: message.eventIds?.length ?? 0,
      });
      for (const eventId of message.eventIds ?? []) {
        syncService.queueEventSync(eventId);
      }
      syncService.triggerSoon(250);
      return;
    }

    if (message.type === "fullResync") {
      logInfo("fallback-worker", "Requested full resync");
      syncService.requestFullResync();
      return;
    }

    if (message.type === "error") {
      logError("fallback-worker", "Worker reported an error", { error: message.error });
    }
  });
  fallbackWorker.on("error", (error) => {
    logError("fallback-worker", "Worker crashed", { error });
  });
  fallbackWorker.on("exit", (code) => {
    if (code !== 0) {
      logWarn("fallback-worker", "Worker exited unexpectedly", { code });
      setTimeout(() => {
        logInfo("fallback-worker", "Restarting fallback worker");
        startFallbackWorker();
      }, 1000);
    }
  });

  return fallbackWorker;
}

client.once(Events.ClientReady, async (readyClient) => {
  try {
    logInfo("bot", "Discord bot ready", {
      user: readyClient.user.tag,
      guildCount: readyClient.guilds.cache.size,
    });

    for (const guild of readyClient.guilds.cache.values()) {
      await interactionHandler.registerGuildCommands(guild).catch((error) => {
        logError("bot", "Failed to register guild commands", { guildId: guild.id, error });
      });
    }

    await syncService.start();

    startFallbackWorker();
  } catch (error) {
    logError("bot", "Ready handler failed", { error });
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isButton()) {
      await interactionHandler.handleButtonInteraction(interaction);
      return;
    }

    if (interaction.isModalSubmit()) {
      await interactionHandler.handleModalSubmit(interaction);
      return;
    }

    if (interaction.isChatInputCommand()) {
      await interactionHandler.handleChatInputCommand(interaction);
    }
  } catch (error) {
    logError("interaction", "Discord interaction failed", {
      type: interaction.type,
      customId: "customId" in interaction ? interaction.customId : undefined,
      commandName: "commandName" in interaction ? interaction.commandName : undefined,
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      error,
    });

    if (interaction.isRepliable()) {
      const message = "Something went wrong while handling that interaction.";
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: message, ephemeral: true }).catch(() => null);
      } else {
        await interaction.reply({ content: message, ephemeral: true }).catch(() => null);
      }
    }
  }
});

client.on(Events.Error, (error) => {
  logError("discord-client", "Discord client error", { error });
});
client.on(Events.Warn, (message) => {
  logWarn("discord-client", "Discord client warning", { message });
});
client.on(Events.ShardError, (error, shardId) => {
  logError("discord-client", "Discord shard error", { shardId, error });
});

void client.login(env.botToken).catch((error) => {
  logError("bot", "Discord login failed", { error });
});
