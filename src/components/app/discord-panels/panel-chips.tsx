import type { ReactNode } from "react"

import type { PanelDeliveryState } from "@/domain/discord-publications/panel-delivery"
import { cn } from "@/lib/utils"

/** Chip colours of the five panel states (P1-11, P1-B01). */
export const STATE_TONES: Record<PanelDeliveryState, string> = {
    published:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300",
    error: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300",
    waiting:
        "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-300",
    unsent: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300",
    paused: "border-border bg-muted text-muted-foreground",
}

export function Pill({
    className,
    children,
}: {
    className?: string
    children: ReactNode
}) {
    return (
        <span
            className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs leading-4 font-medium whitespace-nowrap",
                className
            )}
        >
            {children}
        </span>
    )
}

export function StateChip({
    state,
    label,
}: {
    state: PanelDeliveryState
    label: string
}) {
    return <Pill className={STATE_TONES[state]}>{label}</Pill>
}

/** "HLL" (grey) or "Wardogs" (indigo), as on the boards. */
export function GameChip({ game, label }: { game: string; label: string }) {
    return (
        <span
            className={cn(
                "inline-flex shrink-0 items-center rounded-md border px-1.5 text-[11px] leading-[18px] font-medium",
                game === "wardogs"
                    ? "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-300"
                    : "border-border bg-muted/60 text-muted-foreground"
            )}
        >
            {label}
        </span>
    )
}

/** A row of meta facts separated by middle dots. */
export function MetaLine({
    items,
    className,
}: {
    items: ReadonlyArray<ReactNode>
    className?: string
}) {
    const shown = items.filter(
        (item) => item !== null && item !== undefined && item !== false
    )
    return (
        <div
            className={cn(
                "text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px]",
                className
            )}
        >
            {shown.map((item, index) => (
                <span key={index} className="inline-flex items-center gap-1.5">
                    {index > 0 ? <span aria-hidden="true">·</span> : null}
                    {item}
                </span>
            ))}
        </div>
    )
}
