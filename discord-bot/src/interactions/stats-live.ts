import {
    createStatsRuntimePorts,
    type StatsRuntimeDependencies,
} from "./stats-runtime"
import { createHllRecordsReader } from "../../../src/infrastructure/hll-records/read-profile"
import { panelArtwork } from "../public-panels/assets"
import { makeFunctionReference } from "convex/server"
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
    artwork: panelArtwork,
    send: (request, channelId, payload) =>
        publishStats(client, request, channelId, payload),
}
export const statsController = createStatsController(
    createStatsRuntimePorts(dependencies)
)
