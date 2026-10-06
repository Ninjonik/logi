import { ArrowLeft, ChevronRight } from "lucide-react"
import type { ReactNode } from "react"
import Link from "next/link"

import {
    SETTINGS_SECTIONS,
    settingsMenuSection,
    settingsSectionParent,
    type SettingsSectionId,
    type SettingsSnapshot,
} from "@/domain/workspaces/settings-sections"
import {
    SettingsNav,
    SettingsNavGroups,
} from "@/components/app/settings/settings-nav"
import { ConfigurationScopeIndicator } from "@/components/app/configuration-scope-indicator"
import { SettingsSectionHeader } from "@/components/app/settings/settings-section-header"
import { settingsNavSections } from "@/components/app/settings/settings-snapshot"
import { SettingsNavSheet } from "@/components/app/settings/settings-nav-sheet"
import { settingsHref } from "@/components/app/settings/settings-section-meta"
import type { Dictionary } from "@/i18n/dictionaries"
import type { GameId } from "@/domain/games/game"

/**
 * Pages that edit the selected game show which game they apply to. Channels,
 * messages and `/stats` are clan-wide with per-field game exceptions, so
 * they do not.
 */
const GAME_SCOPED: ReadonlySet<SettingsSectionId> = new Set(["imports"])

/**
 * One settings page (design A2): breadcrumb, the settings menu on the left and
 * the page with its title on the right. On phones the menu opens from a
 * button next to the way back (design K2).
 */
export function SettingsSectionFrame({
    locale,
    serverId,
    gameId,
    section,
    snapshot,
    enabledGames,
    dictionary,
    headerActions,
    legend,
    ownHeader = false,
    crumb,
    mobileBreadcrumb = false,
    children,
}: {
    locale: string
    serverId: string
    gameId?: GameId
    section: SettingsSectionId
    snapshot: SettingsSnapshot
    enabledGames?: GameId[]
    dictionary: Dictionary
    /** Shown on the right of the page title. */
    headerActions?: ReactNode
    /** A line under the page description, such as what a lock icon means. */
    legend?: ReactNode
    /** The page renders its own `SettingsSectionHeader` because its title action is part of its form. */
    ownHeader?: boolean
    /**
     * An item of the page, such as one panel in "Panely v Discordu": the
     * breadcrumb then links the page and ends with this name.
     */
    crumb?: string
    /**
     * On phones the row shows "Sekce" and the short breadcrumb
     * ("Discord › Panely v Discordu", board P1-23) instead of the way back.
     */
    mobileBreadcrumb?: boolean
    children: ReactNode
}) {
    const hub = dictionary.settingsHub
    const text = hub.sections[section]
    const group = SETTINGS_SECTIONS.find((item) => item.id === section)!.group
    const overviewHref = settingsHref(locale, serverId, undefined, gameId)
    // A sub-page ("Grafika panelů") sits under its parent in the breadcrumb
    // and marks the parent in the menu.
    const parent = settingsSectionParent(section)
    const trail: Array<{ label: string; href?: string }> = [
        ...(parent
            ? [
                  {
                      label: hub.sections[parent].title,
                      href: settingsHref(locale, serverId, parent, gameId),
                  },
              ]
            : []),
        ...(crumb
            ? [
                  {
                      label: text.title,
                      href: settingsHref(locale, serverId, section, gameId),
                  },
                  { label: crumb },
              ]
            : [{ label: text.title }]),
    ]
    const navProps = {
        locale,
        serverId,
        gameId,
        sections: settingsNavSections(snapshot),
        active: settingsMenuSection(section),
        dictionary,
    }
    const crumbs = (items: typeof trail) =>
        items.map((item, index) => (
            <span key={index} className="contents">
                {item.href && index < items.length - 1 ? (
                    <Link href={item.href} className="hover:text-foreground">
                        {item.label}
                    </Link>
                ) : (
                    <span
                        aria-current={
                            index === items.length - 1 ? "page" : undefined
                        }
                        className={
                            index === items.length - 1
                                ? "text-foreground min-w-0 truncate"
                                : undefined
                        }
                    >
                        {item.label}
                    </span>
                )}
                {index < items.length - 1 ? (
                    <ChevronRight
                        className="size-3.5 shrink-0"
                        aria-hidden="true"
                    />
                ) : null}
            </span>
        ))
    return (
        <div className="px-4 pb-8 lg:px-6">
            {mobileBreadcrumb ? (
                <div className="flex items-center gap-3 lg:hidden">
                    <SettingsNavSheet
                        label={hub.menu}
                        title={hub.overview.title}
                    >
                        <nav aria-label={hub.sectionNavLabel}>
                            <SettingsNavGroups {...navProps} />
                        </nav>
                    </SettingsNavSheet>
                    <nav
                        aria-label={hub.breadcrumbLabel}
                        className="text-muted-foreground flex min-w-0 items-center gap-1 text-sm"
                    >
                        <span className="shrink-0">{hub.groups[group]}</span>
                        <ChevronRight
                            className="size-3.5 shrink-0"
                            aria-hidden="true"
                        />
                        {crumbs(trail.slice(-1))}
                    </nav>
                </div>
            ) : (
                <div className="flex items-center justify-between gap-3 lg:hidden">
                    <Link
                        href={overviewHref}
                        className="text-muted-foreground hover:text-foreground inline-flex min-h-9 items-center gap-1.5 text-sm"
                    >
                        <ArrowLeft className="size-4" aria-hidden="true" />
                        {hub.overview.title}
                    </Link>
                    <SettingsNavSheet
                        label={hub.menu}
                        title={hub.overview.title}
                    >
                        <nav aria-label={hub.sectionNavLabel}>
                            <SettingsNavGroups {...navProps} />
                        </nav>
                    </SettingsNavSheet>
                </div>
            )}
            <nav
                aria-label={hub.breadcrumbLabel}
                className="text-muted-foreground hidden items-center gap-1.5 text-sm lg:flex"
            >
                <Link href={overviewHref} className="hover:text-foreground">
                    {hub.overview.title}
                </Link>
                <ChevronRight className="size-3.5" aria-hidden="true" />
                <span>{hub.groups[group]}</span>
                <ChevronRight className="size-3.5" aria-hidden="true" />
                {crumbs(trail)}
            </nav>
            <div className="mt-4 grid gap-8 lg:mt-6 lg:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)]">
                <div className="hidden lg:sticky lg:top-4 lg:block lg:self-start">
                    <SettingsNav {...navProps} />
                </div>
                <div className="min-w-0 space-y-6 lg:max-w-4xl">
                    {ownHeader ? null : (
                        <SettingsSectionHeader
                            title={text.title}
                            description={text.description}
                            actions={headerActions}
                            legend={legend}
                        />
                    )}
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
        </div>
    )
}
