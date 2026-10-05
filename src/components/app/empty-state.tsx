import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * An empty list or page (design K4): what is missing, why, and the next step
 * as one or two actions. Use it instead of returning nothing.
 */
export function EmptyState({
    icon: Icon,
    title,
    description,
    actions,
    className,
}: {
    icon?: LucideIcon
    title: string
    description?: string
    actions?: ReactNode
    className?: string
}) {
    return (
        <section
            className={cn(
                "border-border/60 bg-card/50 flex flex-col items-start gap-3 rounded-2xl border p-6",
                className
            )}
        >
            {Icon ? (
                <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-xl">
                    <Icon className="size-5" />
                </span>
            ) : null}
            <h2 className="text-lg font-semibold">{title}</h2>
            {description ? (
                <p className="text-muted-foreground max-w-prose text-sm">
                    {description}
                </p>
            ) : null}
            {actions ? (
                <div className="flex flex-wrap gap-2">{actions}</div>
            ) : null}
        </section>
    )
}
