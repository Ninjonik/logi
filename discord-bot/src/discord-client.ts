import { resourceCreationRequest } from "./runtime/resource-http"
import { Client, GatewayIntentBits, Partials } from "discord.js"
import { env } from "./environment"

export const client = new Client({
    rest: { makeRequest: resourceCreationRequest() },
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        ...(env.leagueMessageContent
            ? [
                  GatewayIntentBits.GuildMessages,
                  GatewayIntentBits.MessageContent,
              ]
            : []),
    ],
    partials: [Partials.Message, Partials.Channel],
})
