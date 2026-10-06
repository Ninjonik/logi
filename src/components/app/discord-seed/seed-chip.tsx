import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

import type { SeedChipTone } from "./seed-page-state"

const TONES: Record<SeedChipTone, string> = {
    success:
        "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
    warning:
        "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100",
    neutral: "border-border bg-muted text-muted-foreground",
    danger: "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-200",
    info: "border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-200",
}

/** A state chip of the seed page ("Pod hranicí startu", "Živý", "Seed běží"). */
export function SeedChip({
    tone,
    children,
    className,
}: {
    tone: SeedChipTone
    children: ReactNode
    className?: string
}) {
    return (
        <span
            className={cn(
                "inline-flex h-6 shrink-0 items-center gap-1 rounded-full border px-2 text-xs font-medium whitespace-nowrap",
                TONES[tone],
                className
            )}
        >
            {children}
        </span>
    )
}
