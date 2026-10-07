import {
    createStatsRuntimePorts,
    type StatsRuntimeDependencies,
} from "./stats-runtime"
import { statsCommandSettingsSchema } from "../../../src/domain/player-stats/command-settings"
import { createHllRecordsReader } from "../../../src/infrastructure/hll-records/read-profile"
import { applicationFactionEmoji } from "../runtime/faction-emoji"
import { guildCommandConfigs } from "../commands/runtime"
import { makeFunctionReference } from "convex/server"
import type { InteractionFeature } from "./registry"
import { createStatsController } from "./stats"
import { publishStats } from "./stats-publish"
import { client } from "../discord-client"
import { env } from "../environment"
import { convex } from "../convex"

const account = makeFunctionReference<"query">("discordPlayerStats:account"),
    history = makeFunctionReference<"query">("discordPlayerStats:history"),
    link = makeFunctionReference<"mutation">("discordPlayerStats:linkSteam")
const dependencies: StatsRuntimeDependencies = {
    member: async (guildId, id) => {
        const guild = client.guilds.cache.get(guildId)
        if (!guild) return false
        const member = await guild.members.fetch({ user: id, force: true })
        return !member.user.bot
    },
    account: (scope, targetId) =>
        convex.query(account, {
            ...scope,
            targetId,
            secret: env.internalSecret,
        }),
    history: (scope, cursor, revision, filters, steamId) =>
        convex.query(history, {
            ...scope,
            cursor,
            revision,
            filters,
            steamId,
            secret: env.internalSecret,
        }),
    link: (scope, steamId, name, expectedSteamIds) =>
        convex.mutation(link, {
            ...scope,
            steamId,
            name,
            expectedSteamIds,
            secret: env.internalSecret,
        }),
    hll: createHllRecordsReader(),
    send: (request, channelId, payload) =>
        publishStats(client, request, channelId, payload),
    // The live command settings: `/stats`'s switch, games and share channel.
    settings: async (guildId) => {
        const config = await guildCommandConfigs.get(guildId)
        const parsed = statsCommandSettingsSchema.safeParse(
            config?.statsSettings ?? undefined
        )
        return parsed.success ? parsed.data : undefined
    },
}
export const statsController = createStatsController({
    ...createStatsRuntimePorts(dependencies),
    access: { configs: guildCommandConfigs },
    factionEmoji: () => applicationFactionEmoji(client),
})

/** Routes `/stats`, its autocomplete, buttons, channel select and window. */
export const statsInteractions: InteractionFeature = {
    name: "stats",
    register(registry) {
        registry
            .command("stats", (interaction) =>
                statsController.command(interaction)
            )
            .autocomplete("stats", (interaction) =>
                statsController.autocomplete(interaction)
            )
            .button("stats:", (interaction) =>
                statsController.button(interaction)
            )
            .channelSelect("stats:", (interaction) =>
                statsController.channel(interaction)
            )
            .modal("stats:", (interaction) =>
                statsController.modal(interaction)
            )
    },
}
