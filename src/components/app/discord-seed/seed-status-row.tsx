"use client"

import { Square, Sprout } from "lucide-react"

import type { SeedDashboardView } from "@/application/discord-seed/read-dashboard"
import type { SeedServerStatus } from "@/domain/discord-seed/thresholds"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"

import {
    fillSeedText,
    seedAgo,
    seedDayTime,
    type SeedChipTone,
} from "./seed-page-state"
import { SeedChip } from "./seed-chip"

const STATUS_TONES: Record<SeedServerStatus, SeedChipTone> = {
    live: "success",
    below_start: "warning",
    filling: "info",
    offline: "danger",
    unknown: "neutral",
}

/**
 * The status row of one server (P3-04, P3-05): the current count and state,
 * when the data and the seeds were, and "Seed teď" or, during a seed,
 * "Ukončit seed". Both act in Discord at once.
 */
export function SeedStatusRow({
    status,
    activeRun,
    locale,
    timeZone,
    now,
    busy,
    text,
    onStart,
    onStop,
}: {
    status: SeedDashboardView["status"]
    activeRun: SeedDashboardView["activeRun"]
    locale: string
    timeZone: string
    now: number
    busy: boolean
    text: Dictionary["seedPage"]
    onStart(): void
    onStop(): void
}) {
    const number = (value: number) =>
        new Intl.NumberFormat(locale).format(value)
    const count =
        status.players === null
            ? text.status.noData
            : status.capacity === null
              ? fillSeedText(text.status.nowNoCapacity, {
                    players: number(status.players),
                })
              : fillSeedText(text.status.now, {
                    players: number(status.players),
                    capacity: number(status.capacity),
                })
    const facts = [
        status.map,
        activeRun?.progress.players != null
            ? fillSeedText(text.status.progress, {
                  players: number(activeRun.progress.players),
                  liveFrom: number(activeRun.progress.liveFrom),
              })
            : null,
        status.observedAt
            ? fillSeedText(text.status.lastData, {
                  time: seedAgo(status.observedAt, now, locale),
              })
            : null,
        status.nextScheduledAt && !activeRun
            ? fillSeedText(text.status.nextSeed, {
                  time: seedDayTime(
                      status.nextScheduledAt,
                      now,
                      timeZone,
                      locale,
                      text.time
                  ),
              })
            : null,
        status.lastStartedAt
            ? fillSeedText(text.status.lastSeed, {
                  time: seedDayTime(
                      status.lastStartedAt,
                      now,
                      timeZone,
                      locale,
                      text.time
                  ),
              })
            : null,
    ].filter(Boolean)
    return (
        <section
            aria-label={count}
            className="bg-card flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
        >
            <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold">{count}</p>
                    <SeedChip tone={STATUS_TONES[status.serverStatus]}>
                        {text.status.chips[status.serverStatus]}
                    </SeedChip>
                    <SeedChip tone={activeRun ? "info" : "neutral"}>
                        {activeRun ? text.status.running : text.status.idle}
                    </SeedChip>
                </div>
                {facts.length ? (
                    <p className="text-muted-foreground text-[13px]">
                        {facts.join(" · ")}
                    </p>
                ) : null}
            </div>
            {activeRun ? (
                <Button
                    type="button"
                    variant="outline"
                    className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0 rounded-xl"
                    disabled={busy}
                    onClick={onStop}
                >
                    <Square className="size-4" aria-hidden="true" />
                    {busy ? text.status.busy : text.status.stopNow}
                </Button>
            ) : (
                <Button
                    type="button"
                    className="shrink-0 rounded-xl"
                    disabled={busy}
                    onClick={onStart}
                >
                    <Sprout className="size-4" aria-hidden="true" />
                    {busy ? text.status.busy : text.status.startNow}
                </Button>
            )}
        </section>
    )
}
