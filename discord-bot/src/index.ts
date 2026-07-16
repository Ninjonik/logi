import { Events } from "discord.js";

import { client } from "./discord-client";
import { env } from "./environment";
import { createInteractionHandler } from "./interactions";
import { createPollLoop } from "./sync";

const queuedEventIds = new Set<string>();
const pollLoop = createPollLoop({ client, queuedEventIds });

function enqueueEventSync(eventId: string) {
  queuedEventIds.add(eventId);
}

function triggerPollSoon() {
  setTimeout(() => {
    void pollLoop();
  }, 2000);
}

const interactionHandler = createInteractionHandler({
  enqueueEventSync,
  triggerPollSoon,
});

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Discord bot ready as ${readyClient.user.tag}`);
  for (const guild of readyClient.guilds.cache.values()) {
    await interactionHandler.registerGuildCommands(guild).catch((error) => {
      console.error("Failed to register guild commands", { guildId: guild.id, error });
    });
  }
  void pollLoop();
  setInterval(() => {
    void pollLoop();
  }, 15000);
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
