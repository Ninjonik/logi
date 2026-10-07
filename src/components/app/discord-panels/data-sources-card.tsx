import { Activity, ArrowRight, Check, TriangleAlert } from "lucide-react"
import Link from "next/link"

import { sourceLiveRead } from "@/domain/discord-publications/panel-list"
import type { Dictionary } from "@/i18n/dictionaries"
import { cn } from "@/lib/utils"

import type { PanelOverviewResponse } from "./panels-api"
import { GameChip } from "./panel-chips"
import { timeAgo } from "./panel-time"
import { fill } from "./panel-copy"

type Source = PanelOverviewResponse["sources"][number]

/** "Sbírá · poslední data před 40 s" of one source, with its tone. */
export function sourceHealthLine(
    source: Source,
    input: { now: number; locale: string; dictionary: Dictionary }
): { text: string; ok: boolean } {
    const t = input.dictionary.discordPanelsPage.sources
    const ago = source.lastDataAt
        ? timeAgo(source.lastDataAt, input.now, input.locale)
        : null
    if (!source.collecting) return { text: t.notCollecting, ok: false }
    if (!ago) return { text: t.collectingNoData, ok: false }
    if (source.freshness === "unavailable")
        return { text: fill(t.unavailable, { ago }), ok: false }
    if (source.freshness === "stale")
        return { text: fill(t.stale, { ago }), ok: false }
    return { text: fill(t.collecting, { ago }), ok: true }
}

export function sourceLive(
    source: Pick<Source, "connectionId">,
    overview: PanelOverviewResponse,
    now: number
) {
    return sourceLiveRead({
        connectionId: source.connectionId,
        now,
        panels: overview.panels.map((panel) => ({
            kind: panel.kind,
            connectionId: panel.connectionId,
            warnings: panel.warnings,
            dataAt: panel.timeline.dataAt,
        })),
    })
}

function Line({ ok, children }: { ok: boolean; children: string }) {
    const Icon = ok ? Check : TriangleAlert
    return (
        <div
            className={cn(
                "flex items-start gap-1.5 text-xs",
                ok
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-amber-700 dark:text-amber-400"
            )}
        >
            <Icon className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            <span>{children}</span>
        </div>
    )
}

/**
 * "Zdroje dat" (P1-07..10, P1-B07): every game server the panels read, with
 * its collection state, the age of the last data and the live-read check.
 */
export function DataSourcesCard({
    overview,
    gameServersHref,
    now,
    locale,
    dictionary,
}: {
    overview: PanelOverviewResponse
    gameServersHref: string
    now: number
    locale: string
    dictionary: Dictionary
}) {
    const text = dictionary.discordPanelsPage
    const t = text.sources
    return (
        <section
            aria-labelledby="panel-sources"
            className="bg-card space-y-3 rounded-2xl border p-4 sm:p-5"
        >
            <div className="flex items-center justify-between gap-3">
                <h2
                    id="panel-sources"
                    className="flex items-center gap-2 text-base font-semibold"
                >
                    <Activity className="size-4" aria-hidden="true" />
                    {t.title}
                </h2>
                <Link
                    href={gameServersHref}
                    className="inline-flex items-center gap-1 text-[13px] font-medium underline underline-offset-3"
                >
                    {t.link}
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
            </div>
            {overview.sources.length ? (
                <ul className="grid gap-2.5 md:grid-cols-3">
                    {overview.sources.map((source) => {
                        const health = sourceHealthLine(source, {
                            now,
                            locale,
                            dictionary,
                        })
                        const live = sourceLive(source, overview, now)
                        const provider =
                            source.provider === "hll_crcon" ||
                            source.provider === "wardogs_warcon"
                                ? t.providers[source.provider]
                                : null
                        return (
                            <li
                                key={source.connectionId}
                                className="space-y-1 rounded-xl border px-3 py-2.5"
                            >
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-sm font-semibold">
                                        {source.name ??
                                            text.list.titles.unknownServer}
                                    </span>
                                    {source.gameId === "hell_let_loose" ||
                                    source.gameId === "wardogs" ? (
                                        <GameChip
                                            game={source.gameId}
                                            label={text.games[source.gameId]}
                                        />
                                    ) : null}
                                    {provider ? (
                                        <span className="text-muted-foreground text-xs">
                                            {provider}
                                        </span>
                                    ) : null}
                                </div>
                                <Line ok={health.ok}>{health.text}</Line>
                                {live === "ok" ? (
                                    <Line ok>{t.liveOk}</Line>
                                ) : live === "limited" ? (
                                    <Line ok={false}>{t.liveLimited}</Line>
                                ) : null}
                            </li>
                        )
                    })}
                </ul>
            ) : (
                <p className="text-muted-foreground text-sm">{t.empty}</p>
            )}
        </section>
    )
}
