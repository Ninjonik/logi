import { makeFunctionReference } from "convex/server"
import type { Client, Guild } from "discord.js"

import {
    createCommandRegistration,
    type RegistrationRecord,
} from "./registration"
import { GuildCommandConfigs } from "./guild-configs"
import { logError, logInfo, logWarn } from "../log"
import { env } from "../environment"
import { convex } from "../convex"

const listGuildConfigs = makeFunctionReference<"query">(
    "discordCommands:listGuildConfigs"
)
const recordRegistration = makeFunctionReference<"mutation">(
    "discordCommands:recordRegistration"
)
const workspaceOfReference = makeFunctionReference<"query">(
    "discordCommands:workspaceOf"
)

/** Every configured server's command settings, kept live from Convex. */
export const guildCommandConfigs = new GuildCommandConfigs({
    list: () => convex.query(listGuildConfigs, { secret: env.internalSecret }),
    watch: (onRows) => {
        const watch = convex.watchQuery(listGuildConfigs, {
            secret: env.internalSecret,
        })
        return watch.onUpdate(() => {
            try {
                const rows = watch.localQueryResult()
                if (rows !== undefined) onRows(rows)
            } catch (error) {
                logWarn("commands", "Command settings update failed", {
                    error,
                })
            }
        })
    },
})

/** The Logi workspace of a server (for dashboard links), or null. */
export async function workspaceOf(guildId: string) {
    try {
        return (await convex.query(workspaceOfReference, {
            secret: env.internalSecret,
            guildId,
        })) as { workspaceId: string; name: string } | null
    } catch {
        return null
    }
}

let registration: ReturnType<typeof createCommandRegistration> | null = null

function registrationFor(client: Client) {
    registration ??= createCommandRegistration({
        configs: guildCommandConfigs,
        guild: (guildId) => client.guilds.cache.get(guildId),
        record: (record: RegistrationRecord) =>
            convex.mutation(recordRegistration, {
                secret: env.internalSecret,
                ...record,
            }),
        now: Date.now,
        log: (level, message, details) =>
            (level === "error"
                ? logError
                : level === "warn"
                  ? logWarn
                  : logInfo)("commands", message, details),
    })
    return registration
}

/**
 * ClientReady: registers the commands in every server the bot is in, then
 * follows the live settings so a language change, saved command settings or
 * "Znovu zaregistrovat" register them again (M1-17, M1-19, M1-B01).
 */
export async function startCommandRegistration(client: Client) {
    const registrar = registrationFor(client)
    await registrar.registerAll(client.guilds.cache.values())
    guildCommandConfigs.start((guildIds) => registrar.configsChanged(guildIds))
}

/** GuildCreate: the bot was added to a server (M1-18). */
export async function registerJoinedGuild(client: Client, guild: Guild) {
    await registrationFor(client).registerGuild(guild, "guildCreate")
}
