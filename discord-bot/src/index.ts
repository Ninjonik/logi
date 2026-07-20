import { Events } from "discord.js";
import { Worker } from "node:worker_threads";

import { client } from "./discord-client";
import { env } from "./environment";
import { createInteractionHandler } from "./interactions";
import { DiscordSyncService } from "./runtime/sync-service";

const syncService = new DiscordSyncService(client);

function triggerPollSoon() {
  syncService.triggerSoon();
}

const interactionHandler = createInteractionHandler({
  enqueueEventSync: (eventId) => syncService.queueEventSync(eventId),
  triggerPollSoon,
});

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Discord bot ready as ${readyClient.user.tag}`);
  for (const guild of readyClient.guilds.cache.values()) {
    await interactionHandler.registerGuildCommands(guild).catch((error) => {
      console.error("Failed to register guild commands", { guildId: guild.id, error });
    });
  }
  await syncService.start();

  const fallbackWorker = new Worker(new URL("./runtime/fallback-worker.ts", import.meta.url), {
    execArgv: process.execArgv,
  });
  fallbackWorker.on("message", (message: { type: string; eventIds?: string[]; error?: string }) => {
    if (message.type === "eventsChanged") {
      for (const eventId of message.eventIds ?? []) {
        syncService.queueEventSync(eventId);
      }
      syncService.triggerSoon(250);
      return;
    }

    if (message.type === "fullResync") {
      syncService.requestFullResync();
      return;
    }

    if (message.type === "error") {
      console.error("Discord fallback worker failed", message.error);
    }
  });
  fallbackWorker.on("error", (error) => {
    console.error("Discord fallback worker crashed", error);
  });
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
    console.error("Discord interaction failed", {
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

void client.login(env.botToken);
