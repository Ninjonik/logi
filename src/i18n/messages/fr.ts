import { accountSettingsMessages } from "./fr/account-settings"
import { panelGraphicsMessages } from "./fr/panel-graphics"
import { discordPanelsMessages } from "./fr/discord-panels"
import { integrationsMessages } from "./fr/integrations"
import { competitionsMessages } from "./fr/competitions"
import { applicationsMessages } from "./fr/applications"
import { matchEditorMessages } from "./fr/match-editor"
import { matchDetailMessages } from "./fr/match-detail"
import { publicSiteMessages } from "./fr/public-site"
import { navigationMessages } from "./fr/navigation"
import { membershipMessages } from "./fr/membership"
import { teamAdminMessages } from "./fr/team-admin"
import { sharedMatchCopy } from "./shared-matches"
import { dashboardMessages } from "./fr/dashboard"
import { gameDataMessages } from "./fr/game-data"
import { settingsMessages } from "./fr/settings"
import { seedingMessages } from "./fr/seeding"
import { rostersMessages } from "./fr/rosters"
import { matchesMessages } from "./fr/matches"
import { contentMessages } from "./fr/content"
import { eventsMessages } from "./fr/events"
import { commonMessages } from "./fr/common"
import { teamsMessages } from "./fr/teams"

export const frMessages = {
    sharedMatches: sharedMatchCopy.fr,
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
