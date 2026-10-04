import { Client, GatewayIntentBits, Partials } from "discord.js"
import { env } from "./environment"

export const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        ...(env.leagueMessageContent
            ? [
                  GatewayIntentBits.GuildMessages,
                  GatewayIntentBits.MessageContent,
              ]
            : []),
    ],
    partials: [Partials.Message, Partials.Channel],
})
