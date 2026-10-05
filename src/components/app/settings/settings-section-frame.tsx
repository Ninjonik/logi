import type { ReactNode } from "react"

import {
    settingsSectionStatus,
    type SettingsSectionId,
    type SettingsSnapshot,
} from "@/domain/workspaces/settings-sections"
import { ConfigurationScopeIndicator } from "@/components/app/configuration-scope-indicator"
import { SettingsStatusBadge } from "@/components/app/settings/settings-status-badge"
import { settingsNavSections } from "@/components/app/settings/settings-snapshot"
import { SettingsNav } from "@/components/app/settings/settings-nav"
import { PageHeader } from "@/components/app/page-header"
import type { Dictionary } from "@/i18n/dictionaries"
import type { GameId } from "@/domain/games/game"

/** Pages whose settings can differ per game show which game they apply to. */
const GAME_SCOPED: ReadonlySet<SettingsSectionId> = new Set([
    "channels",
    "stats",
    "messages",
    "imports",
])

/** One settings page: its title and state, the settings menu and the page's forms. */
export function SettingsSectionFrame({
    locale,
    serverId,
    gameId,
    section,
    snapshot,
    enabledGames,
    dictionary,
    children,
}: {
    locale: string
    serverId: string
    gameId?: GameId
    section: SettingsSectionId
    snapshot: SettingsSnapshot
    enabledGames?: GameId[]
    dictionary: Dictionary
    children: ReactNode
}) {
    const text = dictionary.settingsHub.sections[section]
    return (
        <>
            <PageHeader
                title={text.title}
                description={text.description}
                badges={
                    <SettingsStatusBadge
                        state={settingsSectionStatus(section, snapshot).state}
                        dictionary={dictionary}
                    />
                }
            />
            <div className="grid gap-6 px-4 pb-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:px-6">
                <div className="lg:sticky lg:top-4 lg:self-start">
                    <SettingsNav
                        locale={locale}
                        serverId={serverId}
                        gameId={gameId}
                        sections={settingsNavSections(snapshot)}
                        active={section}
                        dictionary={dictionary}
                    />
                </div>
                <div className="min-w-0 space-y-6">
                    {GAME_SCOPED.has(section) ? (
                        <ConfigurationScopeIndicator
                            enabledGames={enabledGames}
                            gameId={gameId}
                            dictionary={dictionary}
                        />
                    ) : null}
                    {children}
                </div>
            </div>
        </>
    )
}
