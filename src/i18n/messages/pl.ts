import { accountSettingsMessages } from "./pl/account-settings"
import { panelGraphicsMessages } from "./pl/panel-graphics"
import { discordPanelsMessages } from "./pl/discord-panels"
import { integrationsMessages } from "./pl/integrations"
import { competitionsMessages } from "./pl/competitions"
import { applicationsMessages } from "./pl/applications"
import { matchEditorMessages } from "./pl/match-editor"
import { matchDetailMessages } from "./pl/match-detail"
import { publicSiteMessages } from "./pl/public-site"
import { navigationMessages } from "./pl/navigation"
import { membershipMessages } from "./pl/membership"
import { teamAdminMessages } from "./pl/team-admin"
import { sharedMatchCopy } from "./shared-matches"
import { dashboardMessages } from "./pl/dashboard"
import { gameDataMessages } from "./pl/game-data"
import { settingsMessages } from "./pl/settings"
import { seedingMessages } from "./pl/seeding"
import { rostersMessages } from "./pl/rosters"
import { matchesMessages } from "./pl/matches"
import { contentMessages } from "./pl/content"
import { eventsMessages } from "./pl/events"
import { commonMessages } from "./pl/common"
import { teamsMessages } from "./pl/teams"

export const plMessages = {
    sharedMatches: sharedMatchCopy.pl,
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
