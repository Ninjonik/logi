import { CircleCheck, CircleDashed } from "lucide-react"
import Link from "next/link"

import {
    SETTINGS_GROUPS,
    settingsSectionForRequirement,
    settingsSectionStatus,
    settingsSetupProgress,
    visibleSettingsSections,
    type SettingsRequirement,
    type SettingsSnapshot,
} from "@/domain/workspaces/settings-sections"
import {
    SETTINGS_SECTION_ICONS,
    settingsHref,
} from "@/components/app/settings/settings-section-meta"
import { SettingsStatusBadge } from "@/components/app/settings/settings-status-badge"
import { PageHeader } from "@/components/app/page-header"
import type { Dictionary } from "@/i18n/dictionaries"
import type { GameId } from "@/domain/games/game"
import { Button } from "@/components/ui/button"

const REQUIREMENTS: SettingsRequirement[] = [
    "enabledGames",
    "announcements",
    "clanRole",
]

const tileClass =
    "border-border/60 bg-card hover:border-foreground/20 hover:bg-accent/40 focus-visible:ring-ring/50 flex h-full gap-3 rounded-2xl border p-4 transition-colors focus-visible:ring-[3px] focus-visible:outline-none"

/** Settings overview: first-setup progress and every settings page as a card with its state. */
export function SettingsOverview({
    locale,
    serverId,
    gameId,
    snapshot,
    dictionary,
}: {
    locale: string
    serverId: string
    gameId?: GameId
    snapshot: SettingsSnapshot
    dictionary: Dictionary
}) {
    const text = dictionary.settingsHub
    const progress = settingsSetupProgress(snapshot)
    const sections = visibleSettingsSections(snapshot.enabledGames)
    const missing = new Set(
        sections.flatMap(
            (section) => settingsSectionStatus(section.id, snapshot).missing
        )
    )

    return (
        <>
            <PageHeader title={text.title} description={text.description} />
            <div className="space-y-8 px-4 pb-8 lg:px-6">
                {progress.next ? (
                    <section
                        aria-labelledby="settings-setup"
                        className="border-border/60 bg-card space-y-4 rounded-2xl border p-5"
                    >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="space-y-1">
                                <h2
                                    id="settings-setup"
                                    className="text-base font-semibold"
                                >
                                    {text.setupTitle}
                                </h2>
                                <p className="text-muted-foreground text-sm">
                                    {text.setupProgress
                                        .replace(
                                            "{done}",
                                            String(progress.done)
                                        )
                                        .replace(
                                            "{total}",
                                            String(progress.total)
                                        )}
                                </p>
                            </div>
                            <Button asChild className="rounded-xl">
                                <Link
                                    href={settingsHref(
                                        locale,
                                        serverId,
                                        settingsSectionForRequirement(
                                            progress.next
                                        ),
                                        gameId
                                    )}
                                >
                                    {text.continueSetup}
                                </Link>
                            </Button>
                        </div>
                        <div
                            className="bg-muted h-1.5 overflow-hidden rounded-full"
                            role="progressbar"
                            aria-valuemin={0}
                            aria-valuemax={progress.total}
                            aria-valuenow={progress.done}
                            aria-labelledby="settings-setup"
                        >
                            <div
                                className="bg-primary h-full rounded-full"
                                style={{
                                    width: `${(progress.done / progress.total) * 100}%`,
                                }}
                            />
                        </div>
                        <ol className="grid gap-2 sm:grid-cols-3">
                            {REQUIREMENTS.map((requirement) => {
                                const done = !missing.has(requirement)
                                const Icon = done ? CircleCheck : CircleDashed
                                return (
                                    <li key={requirement}>
                                        <Link
                                            href={settingsHref(
                                                locale,
                                                serverId,
                                                settingsSectionForRequirement(
                                                    requirement
                                                ),
                                                gameId
                                            )}
                                            className="hover:bg-accent flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm"
                                        >
                                            <Icon
                                                className={
                                                    done
                                                        ? "size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                                                        : "text-muted-foreground size-4 shrink-0"
                                                }
                                                aria-hidden="true"
                                            />
                                            <span
                                                className={
                                                    done
                                                        ? "text-muted-foreground line-through"
                                                        : "font-medium"
                                                }
                                            >
                                                {text.requirements[requirement]}
                                            </span>
                                        </Link>
                                    </li>
                                )
                            })}
                        </ol>
                    </section>
                ) : null}

                {SETTINGS_GROUPS.map((group) => {
                    const items = sections.filter(
                        (section) => section.group === group
                    )
                    if (!items.length) return null
                    return (
                        <section
                            key={group}
                            aria-labelledby={`settings-group-${group}`}
                            className="space-y-3"
                        >
                            <h2
                                id={`settings-group-${group}`}
                                className="text-muted-foreground text-sm font-medium"
                            >
                                {text.groups[group]}
                            </h2>
                            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                {items.map((section) => {
                                    const Icon =
                                        SETTINGS_SECTION_ICONS[section.id]
                                    const { state } = settingsSectionStatus(
                                        section.id,
                                        snapshot
                                    )
                                    return (
                                        <li key={section.id}>
                                            <Link
                                                href={settingsHref(
                                                    locale,
                                                    serverId,
                                                    section.id,
                                                    gameId
                                                )}
                                                className={tileClass}
                                            >
                                                <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-xl">
                                                    <Icon
                                                        className="size-4"
                                                        aria-hidden="true"
                                                    />
                                                </span>
                                                <span className="flex min-w-0 flex-1 flex-col gap-1">
                                                    <span className="flex flex-wrap items-center justify-between gap-2">
                                                        <span className="font-medium">
                                                            {
                                                                text.sections[
                                                                    section.id
                                                                ].title
                                                            }
                                                        </span>
                                                        <SettingsStatusBadge
                                                            state={state}
                                                            dictionary={
                                                                dictionary
                                                            }
                                                        />
                                                    </span>
                                                    <span className="text-muted-foreground text-sm leading-snug">
                                                        {
                                                            text.sections[
                                                                section.id
                                                            ].description
                                                        }
                                                    </span>
                                                </span>
                                            </Link>
                                        </li>
                                    )
                                })}
                            </ul>
                        </section>
                    )
                })}
            </div>
        </>
    )
}
