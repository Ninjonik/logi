import {
    settingsSectionStatus,
    visibleSettingsSections,
    type SettingsSnapshot,
} from "./settings-sections"

/** How many settings pages of a clan have a required setting missing (the sidebar badge). */
export function settingsAttentionCount(snapshot: SettingsSnapshot): number {
    return visibleSettingsSections(snapshot.enabledGames).filter(
        (section) =>
            settingsSectionStatus(section.id, snapshot).state === "attention"
    ).length
}
