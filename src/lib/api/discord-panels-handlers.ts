import {
    checkDiscordPanelChannel,
    discordPanelsAccess,
    readDiscordPanels,
    requestDiscordPanelAction,
    saveDiscordPanel,
    saveDiscordPanelServer,
    testDiscordPanelFetch,
} from "@/lib/gateways/discord-panels"
import { isDashboardWriteOrigin } from "@/lib/api/dashboard-write-origin"
import { discordPanelsRoutes } from "@/lib/api/discord-panels-route"

/** The panel routes wired to the dashboard session, Convex and Discord. */
export const discordPanelsHandlers = discordPanelsRoutes({
    isWriteOrigin: isDashboardWriteOrigin,
    access: discordPanelsAccess,
    read: readDiscordPanels,
    save: saveDiscordPanel,
    act: requestDiscordPanelAction,
    test: testDiscordPanelFetch,
    checkChannel: checkDiscordPanelChannel,
    saveServer: saveDiscordPanelServer,
})
