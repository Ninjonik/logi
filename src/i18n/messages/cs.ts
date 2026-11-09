import { accountSettingsMessages } from "./cs/account-settings"
import { panelGraphicsMessages } from "./cs/panel-graphics"
import { discordPanelsMessages } from "./cs/discord-panels"
import { integrationsMessages } from "./cs/integrations"
import { competitionsMessages } from "./cs/competitions"
import { applicationsMessages } from "./cs/applications"
import { matchEditorMessages } from "./cs/match-editor"
import { matchDetailMessages } from "./cs/match-detail"
import { publicSiteMessages } from "./cs/public-site"
import { navigationMessages } from "./cs/navigation"
import { membershipMessages } from "./cs/membership"
import { teamAdminMessages } from "./cs/team-admin"
import { sharedMatchCopy } from "./shared-matches"
import { dashboardMessages } from "./cs/dashboard"
import { gameDataMessages } from "./cs/game-data"
import { settingsMessages } from "./cs/settings"
import { seedingMessages } from "./cs/seeding"
import { rostersMessages } from "./cs/rosters"
import { matchesMessages } from "./cs/matches"
import { contentMessages } from "./cs/content"
import { eventsMessages } from "./cs/events"
import { commonMessages } from "./cs/common"
import { teamsMessages } from "./cs/teams"

export const csMessages = {
    sharedMatches: sharedMatchCopy.cs,
    ...commonMessages,
    ...navigationMessages,
    ...publicSiteMessages,
    ...dashboardMessages,
    ...teamsMessages,
    ...teamAdminMessages,
    ...competitionsMessages,
    ...gameDataMessages,
    ...integrationsMessages,
    ...accountSettingsMessages,
    ...membershipMessages,
    ...settingsMessages,
    ...matchDetailMessages,
    ...matchEditorMessages,
    ...matchesMessages,
    ...rostersMessages,
    ...eventsMessages,
    ...contentMessages,
    ...discordPanelsMessages,
    ...panelGraphicsMessages,
    ...seedingMessages,
    ...applicationsMessages,
} as const

export type AppMessages = typeof csMessages
