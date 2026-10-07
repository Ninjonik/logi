import {
    ArrowRight,
    CircleCheck,
    CircleDashed,
    ListChecks,
    TriangleAlert,
} from "lucide-react"
import Link from "next/link"

import {
    settingsSetupSteps,
    settingsTileBadge,
    type SettingsOverviewFacts,
    type SettingsSetupStep,
    type SettingsTileBadge,
} from "@/domain/workspaces/settings-overview"
import {
    SETTINGS_GROUPS,
    visibleSettingsSections,
    type SettingsSectionId,
    type SettingsSnapshot,
} from "@/domain/workspaces/settings-sections"
import {
    SettingsOverviewTiles,
    type SettingsTile,
    type SettingsTileGroup,
} from "@/components/app/settings/settings-overview-tiles"
import {
    guidedSetupHref,
    settingsHref,
} from "@/components/app/settings/settings-section-meta"
import { firstUnfinishedGuidedStep } from "@/domain/workspaces/guided-setup"
import { GAME_LABELS, type GameId } from "@/domain/games/game"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { pluralize } from "@/i18n/plural"
import { cn } from "@/lib/utils"

type Text = Dictionary["settingsHub"]["overview"]

function badgeLabel(
    badge: SettingsTileBadge,
    text: Text["badges"],
    locale: string
) {
    switch (badge.kind) {
        case "done":
        case "notSet":
        case "on":
        case "off":
            return text[badge.kind]
        default:
            return pluralize(locale, badge.count, text[badge.kind])
    }
}

/**
 * The tiles of one settings page. The web page holds three steps, so each
 * opens at its step. Game history lives on the game servers page and gets
 * its own tile at the end of the game data group.
 */
function tilesFor(
    section: SettingsSectionId,
    href: (section: SettingsSectionId, anchor?: string) => string,
    text: Text["tiles"]
): Array<Omit<SettingsTile, "badge">> {
    if (section === "website")
        return (["apiKeys", "login", "webAccess"] as const).map((key) => ({
            key,
            icon: key,
            href: href(section, `website-${key}`),
            ...text[key],
        }))
    const tile = {
        key: section,
        icon: section,
        href: href(section),
        arrow: section === "membership" || section === "tickets",
        ...text[section],
    }
    return [tile]
}

function SetupStep({
    step,
    text,
    detail,
    href,
}: {
    step: SettingsSetupStep
    text: Text["setup"]
    detail: string
    href?: string
}) {
    const Icon =
        step.state === "done"
            ? CircleCheck
            : step.state === "next"
              ? TriangleAlert
              : CircleDashed
    return (
        <li
            className={cn(
                "flex items-start gap-2.5 rounded-xl px-3 py-2.5",
                step.state === "next"
                    ? "bg-amber-500/10"
                    : "bg-muted/60 dark:bg-muted/40"
            )}
        >
            <Icon
                className={cn(
                    "mt-0.5 size-4 shrink-0",
                    step.state === "done"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : step.state === "next"
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-muted-foreground"
                )}
                aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
                <div className="text-sm">
                    {text.steps[step.id].title}
                    {step.optional ? (
                        <span className="text-muted-foreground">
                            {" "}
                            · {text.optional}
                        </span>
                    ) : null}
                </div>
                <div
                    className={cn(
                        "text-[13px] leading-5",
                        step.state === "next"
                            ? "text-amber-800 dark:text-amber-200"
                            : "text-muted-foreground"
                    )}
                >
                    {detail}
                </div>
            </div>
            {step.state !== "done" && href ? (
                <Link
                    href={href}
                    className="shrink-0 text-[13px] font-medium underline underline-offset-4"
                >
                    {step.state === "next" ? text.fix : text.setUp}
                </Link>
            ) : null}
        </li>
    )
}

/** Settings overview (design A1): first-setup progress and every settings page as a tile with its state. */
export function SettingsOverview({
    locale,
    serverId,
    gameId,
    snapshot,
    facts,
    dictionary,
}: {
    locale: string
    serverId: string
    gameId?: GameId
    snapshot: SettingsSnapshot
    facts: SettingsOverviewFacts
    dictionary: Dictionary
}) {
    const hub = dictionary.settingsHub
    const text = hub.overview
    const setup = settingsSetupSteps(snapshot, facts)
    const sections = visibleSettingsSections(snapshot.enabledGames)
    const href = (section: SettingsSectionId, anchor?: string) =>
        `${settingsHref(locale, serverId, section, gameId)}${anchor ? `#${anchor}` : ""}`

    const groups: SettingsTileGroup[] = SETTINGS_GROUPS.map((group) => ({
        id: group,
        title: hub.groups[group],
        hint: text.groupHints[group],
        wide: group === "maintenance",
        tiles: sections
            .filter((section) => section.group === group)
            .flatMap((section) => {
                const badge = settingsTileBadge(section.id, snapshot, facts)
                return tilesFor(section.id, href, text.tiles).map(
                    (tile, index) => ({
                        ...tile,
                        badge:
                            badge && index === 0
                                ? {
                                      tone: badge.tone,
                                      label: badgeLabel(
                                          badge,
                                          text.badges,
                                          locale
                                      ),
                                  }
                                : null,
                    })
                )
            })
            .concat(
                group === "gameData"
                    ? [
                          {
                              key: "history",
                              icon: "history",
                              href: href("game-servers", "game-history"),
                              badge: null,
                              ...text.tiles.history,
                          },
                      ]
                    : []
            ),
    })).filter((group) => group.tiles.length > 0)

    const stepDetail = (step: SettingsSetupStep) => {
        const copy = text.setup.steps
        switch (step.id) {
            case "bot":
                return step.state === "done" ? copy.bot.done : copy.bot.missing
            case "games":
                return snapshot.enabledGames.length
                    ? snapshot.enabledGames
                          .map((game) => GAME_LABELS[game])
                          .join(", ")
                    : copy.games.missing
            case "profile":
                return copy.profile.detail
            case "channels":
                return step.state === "done"
                    ? copy.channels.done
                    : copy.channels.missing
            case "roles":
                return copy.roles.detail
            case "gameServers":
                return step.state === "done"
                    ? pluralize(
                          locale,
                          facts.collectingServers ?? 0,
                          copy.gameServers.done
                      )
                    : copy.gameServers.missing
        }
    }

    const setupCard = setup.complete ? null : (
        <section
            aria-labelledby="settings-setup"
            className="bg-card space-y-5 rounded-2xl border p-5 sm:p-6"
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                    <span className="bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-xl">
                        <ListChecks className="size-4" aria-hidden="true" />
                    </span>
                    <div className="space-y-0.5">
                        <h2
                            id="settings-setup"
                            className="text-base font-semibold"
                        >
                            {text.setup.title}
                        </h2>
                        <p className="text-muted-foreground text-sm">
                            {text.setup.description}
                        </p>
                    </div>
                </div>
                <span className="shrink-0 text-sm font-medium">
                    {text.setup.progress
                        .replace("{done}", String(setup.done))
                        .replace("{total}", String(setup.total))}
                </span>
            </div>
            <div
                className="bg-muted h-1.5 overflow-hidden rounded-full"
                role="progressbar"
                aria-label={text.setup.progressLabel}
                aria-valuemin={0}
                aria-valuemax={setup.total}
                aria-valuenow={setup.done}
            >
                <div
                    className="bg-primary h-full rounded-full"
                    style={{
                        width: `${(setup.done / setup.total) * 100}%`,
                    }}
                />
            </div>
            <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {setup.steps.map((step) => (
                    <SetupStep
                        key={step.id}
                        step={step}
                        text={text.setup}
                        detail={stepDetail(step)}
                        // "Fix" opens the page that holds the setting; "Set up"
                        // and the bot step open the setup guide at that step.
                        href={
                            step.state === "next" && step.section
                                ? href(step.section)
                                : guidedSetupHref(locale, serverId, step.id)
                        }
                    />
                ))}
            </ol>
            <div className="flex flex-wrap items-center gap-3">
                <Button asChild className="rounded-lg">
                    <Link
                        href={guidedSetupHref(
                            locale,
                            serverId,
                            firstUnfinishedGuidedStep(setup.steps)
                        )}
                    >
                        {text.setup.continue}
                        <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                </Button>
                <span className="text-muted-foreground text-[13px]">
                    {text.setup.continueHelp}
                </span>
            </div>
        </section>
    )

    return (
        <div className="px-4 pb-8 lg:px-6">
            <SettingsOverviewTiles
                heading={
                    <div className="space-y-1">
                        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                            {text.title}
                        </h1>
                        <p className="text-muted-foreground text-sm">
                            {text.description}
                        </p>
                    </div>
                }
                setup={setupCard}
                groups={groups}
                labels={{
                    search: text.searchLabel,
                    searchPlaceholder: text.searchPlaceholder,
                    noResults: text.noResults,
                    noResultsDescription: text.noResultsDescription,
                }}
            />
        </div>
    )
}
