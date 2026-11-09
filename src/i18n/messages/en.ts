import { accountSettingsMessages } from "./en/account-settings"
import { panelGraphicsMessages } from "./en/panel-graphics"
import { discordPanelsMessages } from "./en/discord-panels"
import { integrationsMessages } from "./en/integrations"
import { competitionsMessages } from "./en/competitions"
import { applicationsMessages } from "./en/applications"
import { matchEditorMessages } from "./en/match-editor"
import { matchDetailMessages } from "./en/match-detail"
import { publicSiteMessages } from "./en/public-site"
import { navigationMessages } from "./en/navigation"
import { membershipMessages } from "./en/membership"
import { teamAdminMessages } from "./en/team-admin"
import { sharedMatchCopy } from "./shared-matches"
import { dashboardMessages } from "./en/dashboard"
import { gameDataMessages } from "./en/game-data"
import { settingsMessages } from "./en/settings"
import { seedingMessages } from "./en/seeding"
import { rostersMessages } from "./en/rosters"
import { matchesMessages } from "./en/matches"
import { contentMessages } from "./en/content"
import { eventsMessages } from "./en/events"
import { commonMessages } from "./en/common"
import { teamsMessages } from "./en/teams"

export const enMessages = {
    sharedMatches: sharedMatchCopy.en,
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

export type AppMessages = typeof enMessages
