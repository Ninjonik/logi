"use client"

import { useLocale } from "next-intl"
import { Fragment } from "react"

import {
    statsFooter,
    statsNumber,
    statsPeriodLabel,
    statsReplyButtons,
    statsTitle,
    wardogsOverviewFields,
    type WardogsOverviewPlayer,
} from "@/domain/player-stats/stats-reply"
import type { StatsCommandSettings } from "@/domain/player-stats/command-settings"
import { statsCopy } from "@/domain/player-stats/stats-copy"
import type { Dictionary } from "@/i18n/dictionaries"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/** Made-up numbers for the preview; the page labels them as an example. */
const EXAMPLE_PLAYER: WardogsOverviewPlayer = {
    matches: 23,
    wins: 14,
    winRate: 14 / 23,
    unknownResults: 0,
    kd: 1.37,
    metrics: {
        kills: { value: 412, knownGames: 23 },
        deaths: { value: 301, knownGames: 23 },
        cashDelta: { value: 18_400, knownGames: 23 },
        seconds: { value: 61_200, knownGames: 23 },
    },
}

/** The Wardogs colour the bot gives the reply. */
const WARDOGS_ACCENT = "#d8a846"

/** Discord's `**bold**` as bold text; everything else stays plain. */
function DiscordText({ value }: { value: string }) {
    return (
        <span className="whitespace-pre-line">
            {value.split("**").map((part, index) => (
                <Fragment key={index}>
                    {index % 2 ? <strong>{part}</strong> : part}
                </Fragment>
            ))}
        </span>
    )
}

/**
 * Preview of the `/stats` reply in Discord (design G3) with the bot's own
 * layout and copy and clearly marked example numbers. When the command or
 * Wardogs statistics are off it shows the reply people get instead.
 */
export function StatsReplyPreview({
    settings,
    dictionary,
}: {
    settings: StatsCommandSettings
    dictionary: Dictionary
}) {
    const text = dictionary.settingsHub.statsPage
    const locale = useLocale()
    const copy = statsCopy(locale)
    const n = statsNumber(locale)
    const unavailable = !settings.enabled
        ? copy.disabled
        : !settings.games.wardogs
          ? copy.gameDisabled
          : null
    const rows = statsReplyButtons(copy, {
        game: "wardogs",
        publishable: true,
        self: true,
        shared: false,
    })
    return (
        <aside aria-labelledby="stats-preview-title" className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="stats-preview-title" className="text-sm font-semibold">
                    {text.previewTitle}
                </h2>
                <Badge variant="outline" className="rounded-full">
                    {text.previewExample}
                </Badge>
            </div>
            <div className="bg-muted/40 space-y-2.5 rounded-2xl border p-3 sm:p-4">
                <p className="text-muted-foreground text-xs">
                    {text.previewEphemeral}
                </p>
                {unavailable ? (
                    <p className="bg-background rounded-lg border px-3 py-2.5 text-sm">
                        {unavailable}
                    </p>
                ) : (
                    <>
                        <div
                            className="bg-background space-y-3 rounded-lg border border-l-4 p-3 text-sm"
                            style={{ borderLeftColor: WARDOGS_ACCENT }}
                        >
                            <p className="leading-tight font-bold break-words">
                                {statsTitle("wardogs", text.previewPlayer)}
                            </p>
                            <p>
                                <DiscordText
                                    value={`**${statsPeriodLabel(copy, "30d")}**`}
                                />
                            </p>
                            <dl className="space-y-2.5">
                                {wardogsOverviewFields(
                                    copy,
                                    EXAMPLE_PLAYER,
                                    n
                                ).map((field) => (
                                    <div key={field.name}>
                                        <dt className="font-semibold">
                                            {field.name}
                                        </dt>
                                        <dd className="leading-snug">
                                            <DiscordText value={field.value} />
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                            <p className="text-muted-foreground text-xs">
                                {statsFooter(copy, "wardogs")}
                            </p>
                        </div>
                        {rows.map((row, index) => (
                            <div key={index} className="flex flex-wrap gap-1.5">
                                {row.map((button) => (
                                    <span
                                        key={button.action}
                                        className={cn(
                                            "rounded-md px-3 py-1.5 text-xs font-medium",
                                            button.primary
                                                ? "bg-[#5865f2] text-white"
                                                : "bg-muted text-foreground border"
                                        )}
                                    >
                                        {button.label}
                                    </span>
                                ))}
                            </div>
                        ))}
                    </>
                )}
                <p className="text-muted-foreground text-xs">
                    {text.previewNote}
                </p>
            </div>
        </aside>
    )
}
