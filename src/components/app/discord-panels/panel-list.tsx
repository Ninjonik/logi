"use client"

import {
    CalendarDays,
    Layers,
    Pause,
    Play,
    Radio,
    RefreshCw,
    Send,
    SlidersHorizontal,
    Table2,
    Trophy,
    TriangleAlert,
    Award,
    type LucideIcon,
} from "lucide-react"
import Link from "next/link"

import {
    panelStateCounts,
    type PanelRowButton,
} from "@/domain/discord-publications/panel-list"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { GameChip, MetaLine, Pill, StateChip, STATE_TONES } from "./panel-chips"
import type { PanelRowModel } from "./panel-rows"
import { PanelTimingLine } from "./panel-timing"
import { fill, plural } from "./panel-copy"

export type RowAction =
    | {
          kind: "panel"
          panelId: string
          action: "refresh" | "pause" | "resume" | "publish" | "retry"
      }
    | { kind: "control"; connectionId: string }

function RowIcon({ row }: { row: PanelRowModel }) {
    const className = "size-4"
    if (row.source === "control")
        return <SlidersHorizontal className={className} />
    if (row.source === "league-table") return <Award className={className} />
    if (row.source === "league-fixtures")
        return <CalendarDays className={className} />
    switch (row.kind) {
        case "server":
            return <Radio className={className} />
        case "servers":
            return <Layers className={className} />
        case "results":
            return <Trophy className={className} />
        case "calendar":
            return <CalendarDays className={className} />
        default:
            return <Table2 className={className} />
    }
}

/** Row buttons are compact, as on the board (P1-13). */
const ROW_BUTTON = "h-7 rounded-lg px-2.5 text-[13px]"

const BUTTON_ICONS: Partial<Record<PanelRowButton, LucideIcon>> = {
    refresh: RefreshCw,
    pause: Pause,
    resume: Play,
    publish: Send,
}

function PanelRow({
    row,
    editHref,
    busy,
    onAction,
    now,
    locale,
    dictionary,
}: {
    row: PanelRowModel
    editHref: string
    busy: boolean
    onAction: (action: RowAction) => void
    now: number
    locale: string
    dictionary: Dictionary
}) {
    const text = dictionary.discordPanelsPage.list
    const status = dictionary.discordPanelStatus.states
    const act = (button: PanelRowButton) => {
        if (button === "edit") return
        if (row.source === "control" && row.connectionId)
            onAction({ kind: "control", connectionId: row.connectionId })
        else if (row.panelId)
            onAction({ kind: "panel", panelId: row.panelId, action: button })
    }
    return (
        <li className="px-4 py-3.5 sm:px-5">
            <div className="flex gap-3">
                <span
                    aria-hidden="true"
                    className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg"
                >
                    <RowIcon row={row} />
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                        <Link
                            href={editHref}
                            className="min-w-0 text-sm font-semibold hover:underline"
                        >
                            {row.title}
                        </Link>
                        <StateChip
                            state={row.state}
                            label={status[row.state]}
                        />
                    </div>
                    <MetaLine
                        items={row.meta.map((meta, index) =>
                            meta.kind === "game" ? (
                                <GameChip
                                    key={index}
                                    game={meta.game}
                                    label={meta.label}
                                />
                            ) : meta.kind === "servers" ? (
                                <span
                                    key={index}
                                    className="inline-flex items-center gap-1.5"
                                >
                                    <GameChip
                                        game={meta.game}
                                        label={meta.label}
                                    />
                                    {meta.names}
                                </span>
                            ) : (
                                meta.text
                            )
                        )}
                    />
                    <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-end sm:justify-between">
                        <PanelTimingLine
                            parts={row.timing}
                            messageUrl={row.messageUrl}
                            now={now}
                            locale={locale}
                            dictionary={dictionary}
                        />
                        <div
                            role="group"
                            aria-label={fill(text.rowActions, {
                                name: row.title,
                            })}
                            className="flex shrink-0 flex-wrap gap-2 sm:justify-end"
                        >
                            {row.actions.buttons.map((button) => {
                                if (button === "edit")
                                    return (
                                        <Button
                                            key={button}
                                            asChild
                                            variant="outline"
                                            size="sm"
                                            className={ROW_BUTTON}
                                        >
                                            <Link href={editHref}>
                                                {text.buttons.edit}
                                            </Link>
                                        </Button>
                                    )
                                const ButtonIcon = BUTTON_ICONS[button]
                                return (
                                    <Button
                                        key={button}
                                        type="button"
                                        size="sm"
                                        variant={
                                            button === "publish"
                                                ? "default"
                                                : "outline"
                                        }
                                        className={ROW_BUTTON}
                                        disabled={busy}
                                        onClick={() => act(button)}
                                    >
                                        {ButtonIcon ? (
                                            <ButtonIcon
                                                className="size-3.5"
                                                aria-hidden="true"
                                            />
                                        ) : null}
                                        {text.buttons[button]}
                                    </Button>
                                )
                            })}
                        </div>
                    </div>
                    {row.actions.errorBox && row.error ? (
                        <div
                            role="alert"
                            className="mt-2 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] text-red-900 sm:flex-row sm:items-center sm:justify-between dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
                        >
                            <p className="flex items-start gap-2">
                                <TriangleAlert
                                    className="mt-0.5 size-4 shrink-0"
                                    aria-hidden="true"
                                />
                                <span>
                                    <span className="font-semibold">
                                        {row.error.title}
                                    </span>{" "}
                                    {row.error.fix}
                                </span>
                            </p>
                            <div className="flex shrink-0 gap-2">
                                <Button
                                    asChild
                                    size="sm"
                                    className={ROW_BUTTON}
                                >
                                    <Link href={editHref}>
                                        {text.buttons.fix}
                                    </Link>
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className={cn(
                                        ROW_BUTTON,
                                        "bg-white dark:bg-transparent"
                                    )}
                                    disabled={busy || !row.panelId}
                                    onClick={() =>
                                        row.panelId &&
                                        onAction({
                                            kind: "panel",
                                            panelId: row.panelId,
                                            action: "retry",
                                        })
                                    }
                                >
                                    <RefreshCw
                                        className="size-3.5"
                                        aria-hidden="true"
                                    />
                                    {text.buttons.retry}
                                </Button>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </li>
    )
}

/** "Panely" (P1-11..22): the summary chips and every panel row by group. */
export function PanelListCard({
    groups,
    editHref,
    seedHref,
    busy,
    onAction,
    now,
    locale,
    dictionary,
}: {
    groups: Array<{ group: PanelRowModel["group"]; rows: PanelRowModel[] }>
    editHref: (panelId: string) => string
    seedHref: string
    busy: boolean
    onAction: (action: RowAction) => void
    now: number
    locale: string
    dictionary: Dictionary
}) {
    const text = dictionary.discordPanelsPage.list
    const rows = groups.flatMap((group) => group.rows)
    const counts = panelStateCounts(rows.map((row) => row.state))
    return (
        <section
            aria-labelledby="panel-list"
            className="bg-card overflow-hidden rounded-2xl border"
        >
            <div className="space-y-1.5 px-4 pt-4 pb-3 sm:px-5">
                <h2 id="panel-list" className="text-base font-semibold">
                    {text.title}
                </h2>
                <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
                    <span className="text-muted-foreground mr-1">
                        {plural(text.count, rows.length, locale)}
                    </span>
                    {counts.map((entry) => (
                        <Pill
                            key={entry.state}
                            className={STATE_TONES[entry.state]}
                        >
                            {plural(
                                text.states[entry.state],
                                entry.count,
                                locale
                            )}
                        </Pill>
                    ))}
                </div>
            </div>
            {rows.length ? (
                groups.map((group) => (
                    <div key={group.group} className="border-t">
                        <h3 className="bg-muted/50 border-b px-4 py-2 text-[13px] sm:px-5">
                            <span className="font-semibold">
                                {text.groups[group.group].title}
                            </span>
                            {text.groups[group.group].hint ? (
                                <span className="text-muted-foreground">
                                    {" · "}
                                    {text.groups[group.group].hint}
                                </span>
                            ) : null}
                        </h3>
                        <ul className="divide-y">
                            {group.rows.map((row) => (
                                <PanelRow
                                    key={row.key}
                                    row={row}
                                    editHref={
                                        row.panelId
                                            ? editHref(row.panelId)
                                            : seedHref
                                    }
                                    busy={busy}
                                    onAction={onAction}
                                    now={now}
                                    locale={locale}
                                    dictionary={dictionary}
                                />
                            ))}
                        </ul>
                    </div>
                ))
            ) : (
                <p className="text-muted-foreground border-t px-5 py-6 text-sm">
                    {text.empty}
                </p>
            )}
        </section>
    )
}
