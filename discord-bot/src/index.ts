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

const handleButtonInteraction = createInteractionHandler({
  enqueueEventSync,
  triggerPollSoon,
});

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Discord bot ready as ${readyClient.user.tag}`);
  void pollLoop();
  setInterval(() => {
    void pollLoop();
  }, 15000);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;
  if (!interaction.customId.startsWith("signup:") && !interaction.customId.startsWith("attendance:")) return;

  await handleButtonInteraction(interaction);
});

void client.login(env.botToken);
