import type { ReactNode } from "react"

import { MobileActionBar } from "@/components/app/mobile-action-bar"
import { cn } from "@/lib/utils"

/**
 * Accent of Logi's global administration (designs I1–I3): an indigo tint that
 * marks what belongs to the platform rather than to one clan, in both themes.
 */
export const adminAccent = {
    text: "text-indigo-700 dark:text-indigo-300",
    /** Selected list rows and request banners. */
    surface: "bg-indigo-500/10 dark:bg-indigo-400/15",
    border: "border-indigo-500/50 dark:border-indigo-400/50",
    badge: "bg-indigo-500/15 text-indigo-800 dark:bg-indigo-400/20 dark:text-indigo-100",
} as const

/** Status tones shared by the global administration lists. */
export const adminTone = {
    success:
        "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
    warning:
        "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100",
    warningText: "text-amber-800 dark:text-amber-300",
    neutral: "border-border bg-muted/60 text-foreground/80",
} as const

/**
 * Header of a global administration page: the "Global administration"
 * eyebrow, title, description and the page's actions. The primary action
 * moves to the bottom bar on phones.
 */
export function AdminPageHeader({
    eyebrow,
    title,
    description,
    actions,
    primaryAction,
    className,
}: {
    eyebrow: string
    title: string
    description?: string
    actions?: ReactNode
    primaryAction?: ReactNode
    className?: string
}) {
    return (
        <header
            className={cn(
                "flex flex-wrap items-end justify-between gap-4 px-4 lg:px-6",
                className
            )}
        >
            <div className="flex min-w-0 flex-col gap-1">
                <span
                    className={cn(
                        "text-xs font-semibold tracking-wider uppercase",
                        adminAccent.text
                    )}
                >
                    {eyebrow}
                </span>
                <h1 className="text-2xl leading-8 font-semibold tracking-tight">
                    {title}
                </h1>
                {description ? (
                    <p className="text-muted-foreground max-w-3xl text-sm">
                        {description}
                    </p>
                ) : null}
            </div>
            {actions || primaryAction ? (
                <div className="flex flex-wrap items-center gap-2">
                    {actions}
                    {primaryAction ? (
                        <MobileActionBar>{primaryAction}</MobileActionBar>
                    ) : null}
                </div>
            ) : null}
        </header>
    )
}
