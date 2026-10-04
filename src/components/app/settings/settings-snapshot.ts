import {
    visibleSettingsSections,
    settingsSectionStatus,
    type SettingsSnapshot,
} from "@/domain/workspaces/settings-sections"
import type { SettingsNavSection } from "@/components/app/settings/settings-nav"
import { DEFAULT_GAME_ID, type GameId } from "@/domain/games/game"
import type { DiscordConfig } from "@/types/domain"

export function settingsSnapshot(
    enabledGames: GameId[] | undefined,
    config: DiscordConfig | null
): SettingsSnapshot {
    return {
        enabledGames: enabledGames?.length ? enabledGames : [DEFAULT_GAME_ID],
        announcementsChannelId: config?.announcementsChannelId,
        clanRoleId: config?.clanRoleId,
        statsEnabled: Boolean(config?.statsSettings?.enabled),
        membershipEnabled: Boolean(config?.membershipSettings?.enabled),
        ticketsEnabled: Boolean(config?.ticketSettings?.enabled),
    }
}

export function settingsNavSections(
    snapshot: SettingsSnapshot
): SettingsNavSection[] {
    return visibleSettingsSections(snapshot.enabledGames).map((section) => ({
        id: section.id,
        group: section.group,
        state: settingsSectionStatus(section.id, snapshot).state,
    }))
}
