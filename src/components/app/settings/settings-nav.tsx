import Link from "next/link"

import {
    SETTINGS_PRESET_LINKS,
    SETTINGS_SECTION_ICONS,
    settingsHref,
} from "@/components/app/settings/settings-section-meta"
import {
    SETTINGS_GROUPS,
    type SettingsSectionId,
    type SettingsSectionState,
} from "@/domain/workspaces/settings-sections"
import type { Dictionary } from "@/i18n/dictionaries"
import type { GameId } from "@/domain/games/game"
import { cn } from "@/lib/utils"

export type SettingsNavSection = {
    id: SettingsSectionId
    group: (typeof SETTINGS_GROUPS)[number]
    state: SettingsSectionState
}

const itemClass =
    "flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"

function NavGroups({
    locale,
    serverId,
    gameId,
    sections,
    active,
    dictionary,
}: {
    locale: string
    serverId: string
    gameId?: GameId
    sections: SettingsNavSection[]
    active: SettingsSectionId
    dictionary: Dictionary
}) {
    return (
        <div className="space-y-4">
            {SETTINGS_GROUPS.map((group) => {
                const items = sections.filter(
                    (section) => section.group === group
                )
                const presets = group === "matches" ? SETTINGS_PRESET_LINKS : []
                if (!items.length && !presets.length) return null
                return (
                    <div key={group} className="space-y-1">
                        <p className="text-muted-foreground px-2.5 text-xs font-medium">
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
                                                    "bg-accent text-accent-foreground font-medium"
                                            )}
                                        >
                                            <Icon
                                                className="text-muted-foreground size-4 shrink-0"
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
                                                <span
                                                    className="size-2 shrink-0 rounded-full bg-amber-500"
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
                            {presets.map((preset) => (
                                <li key={preset.key}>
                                    <Link
                                        href={`/${locale}/dashboard/servers/${serverId}/${preset.path}`}
                                        className={itemClass}
                                    >
                                        <preset.icon
                                            className="text-muted-foreground size-4 shrink-0"
                                            aria-hidden="true"
                                        />
                                        <span className="min-w-0 flex-1">
                                            {
                                                dictionary.settingsHub
                                                    .presetLinks[preset.key]
                                            }
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                )
            })}
        </div>
    )
}

/**
 * Settings menu beside each settings page. On narrow screens it folds into a
 * disclosure above the page so the form stays first.
 */
export function SettingsNav(props: {
    locale: string
    serverId: string
    gameId?: GameId
    sections: SettingsNavSection[]
    active: SettingsSectionId
    dictionary: Dictionary
}) {
    const { dictionary } = props
    return (
        <nav aria-label={dictionary.settingsHub.sectionNavLabel}>
            <Link
                href={settingsHref(
                    props.locale,
                    props.serverId,
                    undefined,
                    props.gameId
                )}
                className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1 px-2.5 text-sm"
            >
                <span aria-hidden="true">←</span>
                {dictionary.settingsHub.backToOverview}
            </Link>
            <details className="border-border/60 rounded-xl border p-2 lg:hidden">
                <summary className="cursor-pointer px-2.5 py-1.5 text-sm font-medium">
                    {dictionary.settingsHub.sections[props.active].title}
                </summary>
                <div className="pt-3">
                    <NavGroups {...props} />
                </div>
            </details>
            <div className="hidden lg:block">
                <NavGroups {...props} />
            </div>
        </nav>
    )
}
