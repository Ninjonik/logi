import { TriangleAlert } from "lucide-react"
import Link from "next/link"

import {
    SETTINGS_GROUPS,
    type SettingsSectionId,
    type SettingsSectionState,
} from "@/domain/workspaces/settings-sections"
import {
    SETTINGS_SECTION_ICONS,
    settingsHref,
} from "@/components/app/settings/settings-section-meta"
import type { Dictionary } from "@/i18n/dictionaries"
import type { GameId } from "@/domain/games/game"
import { cn } from "@/lib/utils"

export type SettingsNavSection = {
    id: SettingsSectionId
    group: (typeof SETTINGS_GROUPS)[number]
    state: SettingsSectionState
}

type NavProps = {
    locale: string
    serverId: string
    gameId?: GameId
    sections: SettingsNavSection[]
    active: SettingsSectionId
    dictionary: Dictionary
}

const itemClass =
    "flex min-h-8 items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"

/** The settings pages by group, with a warning on pages that miss a required setting. */
export function SettingsNavGroups({
    locale,
    serverId,
    gameId,
    sections,
    active,
    dictionary,
}: NavProps) {
    return (
        <div className="space-y-3">
            {SETTINGS_GROUPS.map((group) => {
                const items = sections.filter(
                    (section) => section.group === group
                )
                if (!items.length) return null
                return (
                    <div key={group} className="space-y-0.5">
                        <p className="text-muted-foreground flex h-8 items-center px-2 text-xs font-medium">
                            {dictionary.settingsHub.groups[group]}
                        </p>
                        <ul className="space-y-0.5">
                            {items.map((section) => {
                                const Icon = SETTINGS_SECTION_ICONS[section.id]
                                const current = section.id === active
                                return (
                                    <li key={section.id}>
                                        <Link
                                            href={settingsHref(
                                                locale,
                                                serverId,
                                                section.id,
                                                gameId
                                            )}
                                            aria-current={
                                                current ? "page" : undefined
                                            }
                                            className={cn(
                                                itemClass,
                                                current &&
                                                    "bg-accent text-accent-foreground font-semibold"
                                            )}
                                        >
                                            <Icon
                                                className="size-4 shrink-0"
                                                aria-hidden="true"
                                            />
                                            <span className="min-w-0 flex-1">
                                                {
                                                    dictionary.settingsHub
                                                        .sections[section.id]
                                                        .title
                                                }
                                            </span>
                                            {section.state === "attention" ? (
                                                <TriangleAlert
                                                    className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400"
                                                    role="img"
                                                    aria-label={
                                                        dictionary.settingsHub
                                                            .status.attention
                                                    }
                                                />
                                            ) : null}
                                        </Link>
                                    </li>
                                )
                            })}
                        </ul>
                    </div>
                )
            })}
        </div>
    )
}

/** Settings menu beside each settings page (design A2). */
export function SettingsNav(props: NavProps) {
    return (
        <nav aria-label={props.dictionary.settingsHub.sectionNavLabel}>
            <SettingsNavGroups {...props} />
        </nav>
    )
}
