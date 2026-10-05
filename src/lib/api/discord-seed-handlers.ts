import {
    discordSeedWebAccess,
    readDiscordSeed,
    saveDiscordSeedPlan,
    startDiscordSeed,
    stopDiscordSeed,
} from "@/lib/gateways/discord-seed"
import { verifySeedChannels } from "@/lib/gateways/discord-seed-channels"
import { isDashboardWriteOrigin } from "@/lib/api/dashboard-write-origin"
import { discordSeedRoutes } from "@/lib/api/discord-seed-route"

/** The seed routes wired to the dashboard session, Convex and Discord. */
export const discordSeedHandlers = discordSeedRoutes({
    isWriteOrigin: isDashboardWriteOrigin,
    access: discordSeedWebAccess,
    read: readDiscordSeed,
    save: saveDiscordSeedPlan,
    verifyChannels: (access, settings) =>
        verifySeedChannels(access.guildId, settings),
    start: startDiscordSeed,
    stop: stopDiscordSeed,
})
