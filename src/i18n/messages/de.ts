import { accountSettingsMessages } from "./de/account-settings"
import { panelGraphicsMessages } from "./de/panel-graphics"
import { discordPanelsMessages } from "./de/discord-panels"
import { integrationsMessages } from "./de/integrations"
import { competitionsMessages } from "./de/competitions"
import { applicationsMessages } from "./de/applications"
import { matchEditorMessages } from "./de/match-editor"
import { matchDetailMessages } from "./de/match-detail"
import { publicSiteMessages } from "./de/public-site"
import { navigationMessages } from "./de/navigation"
import { membershipMessages } from "./de/membership"
import { teamAdminMessages } from "./de/team-admin"
import { sharedMatchCopy } from "./shared-matches"
import { dashboardMessages } from "./de/dashboard"
import { gameDataMessages } from "./de/game-data"
import { settingsMessages } from "./de/settings"
import { seedingMessages } from "./de/seeding"
import { rostersMessages } from "./de/rosters"
import { matchesMessages } from "./de/matches"
import { contentMessages } from "./de/content"
import { eventsMessages } from "./de/events"
import { commonMessages } from "./de/common"
import { teamsMessages } from "./de/teams"

export const deMessages = {
    sharedMatches: sharedMatchCopy.de,
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

export type AppMessages = typeof deMessages
