"use client"

import { Eye, Lock, Volume2, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import Link from "next/link"

import { GameScopeChip } from "@/components/app/settings/discord-channel-settings-form"
import type { GameId } from "@/domain/games/game"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type RowChipTone = "new" | "error" | "warning" | "neutral" | "game"

const CHIP_CLASSES: Record<RowChipTone, string> = {
    new: "border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-200",
    game: "border-indigo-500/30 bg-indigo-500/10 text-indigo-800 dark:text-indigo-200",
    error: "border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-200",
    warning:
        "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100",
    neutral: "border-border bg-muted text-muted-foreground",
}

/** A small label next to a row title: "Nové", "HLL", "Chyba". */
export function RowChip({
    tone,
    children,
}: {
    tone: RowChipTone
    children: ReactNode
}) {
    return (
        <span
            className={cn(
                "inline-flex h-5 shrink-0 items-center rounded-md border px-1.5 text-xs font-medium",
                CHIP_CLASSES[tone]
            )}
        >
            {children}
        </span>
    )
}

/** Where a message goes: one channel, a game's exception and the owning page. */
export type MessageTarget = {
    /** "# oznameni", "kategorie Akce", "DM hráčům"; plain text. */
    lines?: Array<{
        text: string
        kind?: "channel" | "voice" | "plain"
        game?: GameId
    }>
    /** "z Kanály a jazyk": the page that owns the channel. */
    from?: { prefix: string; label: string; href: string }
}

/** The target column: channel names, game exceptions and the lock line (N1-B04). */
export function MessageTargetView({ target }: { target: MessageTarget }) {
    return (
        <div className="min-w-0 space-y-0.5 text-[13px] leading-5">
            {target.lines?.map((line, index) => (
                <div
                    key={index}
                    className="flex min-w-0 flex-wrap items-center gap-1.5"
                >
                    {line.game ? <GameScopeChip gameId={line.game} /> : null}
                    {line.kind === "voice" ? (
                        <Volume2
                            className="text-muted-foreground size-3.5 shrink-0"
                            aria-hidden="true"
                        />
                    ) : null}
                    <span
                        className={cn(
                            "min-w-0 break-words",
                            line.kind === "plain"
                                ? "text-muted-foreground"
                                : "text-foreground"
                        )}
                    >
                        {line.kind === "channel" ? (
                            <span className="text-muted-foreground">
                                #&nbsp;
                            </span>
                        ) : null}
                        {line.text}
                    </span>
                </div>
            ))}
            {target.from ? (
                <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <Lock className="size-3 shrink-0" aria-hidden="true" />
                    <span>
                        {target.from.prefix}{" "}
                        <Link
                            href={target.from.href}
                            className="text-foreground underline underline-offset-3"
                        >
                            {target.from.label}
                        </Link>
                    </span>
                </div>
            ) : null}
        </div>
    )
}

/**
 * One row of "Co bot posílá" (board N1 1.2): icon, title with chips, what
 * the message is, where it goes, an optional switch and "Náhled" (or a link
 * to the owning page). The preview opens under the row.
 */
export function MessageRow({
    icon: Icon,
    title,
    chips,
    detail,
    extra,
    target,
    toggle,
    action,
    children,
}: {
    icon: LucideIcon
    title: string
    chips?: ReactNode
    detail: ReactNode
    /** Controls under the detail, e.g. the roster's default look. */
    extra?: ReactNode
    target?: ReactNode
    toggle?: {
        checked: boolean
        onChange(checked: boolean): void
        /** The switch's accessible name (N1-45a). */
        label: string
        disabled?: boolean
        describedBy?: string
    }
    action?: ReactNode
    /** The open preview or editor. */
    children?: ReactNode
}) {
    return (
        <li className="px-4 py-4 sm:px-6">
            <div className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 gap-y-3 md:grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,13rem)_2.25rem_6.75rem] md:items-center">
                <span className="bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-lg">
                    <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="text-sm font-semibold">{title}</h3>
                        {chips}
                    </div>
                    <div className="text-muted-foreground text-[13px] leading-5">
                        {detail}
                    </div>
                    {extra ? <div className="pt-1.5">{extra}</div> : null}
                </div>
                <div className="col-span-2 flex min-w-0 flex-wrap items-center justify-between gap-3 md:contents">
                    <div className="min-w-0 md:col-start-3">{target}</div>
                    <div className="flex shrink-0 items-center justify-end gap-3 md:contents">
                        <div className="flex md:col-start-4 md:justify-center">
                            {toggle ? (
                                <Switch
                                    checked={toggle.checked}
                                    onCheckedChange={toggle.onChange}
                                    aria-label={toggle.label}
                                    aria-describedby={toggle.describedBy}
                                    disabled={toggle.disabled}
                                />
                            ) : null}
                        </div>
                        <div className="flex md:col-start-5 md:justify-end">
                            {action}
                        </div>
                    </div>
                </div>
            </div>
            {children ? <div className="mt-4 md:pl-12">{children}</div> : null}
        </li>
    )
}

/** "Náhled" / "Zavřít" for a row whose preview opens under it. */
export function PreviewButton({
    open,
    onClick,
    controls,
    previewLabel,
    closeLabel,
}: {
    open: boolean
    onClick(): void
    controls: string
    previewLabel: string
    closeLabel: string
}) {
    return (
        <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg"
            aria-expanded={open}
            aria-controls={controls}
            onClick={onClick}
        >
            <Eye className="size-3.5" aria-hidden="true" />
            {open ? closeLabel : previewLabel}
        </Button>
    )
}

/** A group heading inside the list: "Zápasy", "Soukromé zprávy · …". */
export function MessageGroup({
    title,
    note,
    children,
}: {
    title: string
    note?: string
    children: ReactNode
}) {
    return (
        <>
            <li className="bg-muted/50 border-y px-4 py-2.5 text-sm sm:px-6">
                <span className="font-semibold">{title}</span>
                {note ? (
                    <span className="text-muted-foreground"> · {note}</span>
                ) : null}
            </li>
            {children}
        </>
    )
}
