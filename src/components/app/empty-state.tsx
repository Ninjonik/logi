import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * An empty list or page (design K4): an icon, what is missing, why, and the
 * next step as one or two actions, centred in a dashed frame. Use it instead
 * of returning nothing.
 */
export function EmptyState({
    icon: Icon,
    title,
    description,
    actions,
    className,
    headingLevel = "h2",
}: {
    icon?: LucideIcon
    /** Use "h1" when the empty state is the whole page, such as a 404. */
    headingLevel?: "h1" | "h2"
    title: string
    description?: string
    actions?: ReactNode
    className?: string
}) {
    const Heading = headingLevel
    return (
        <section
            className={cn(
                "bg-card border-muted-foreground/30 flex flex-col items-center gap-3 rounded-[14px] border border-dashed px-6 py-9 text-center",
                className
            )}
        >
            {Icon ? (
                <span className="bg-muted text-foreground flex size-11 items-center justify-center rounded-xl">
                    <Icon aria-hidden="true" className="size-5" />
                </span>
            ) : null}
            <Heading className="text-base font-semibold">{title}</Heading>
            {description ? (
                <p className="text-muted-foreground max-w-sm text-sm leading-5 text-balance">
                    {description}
                </p>
            ) : null}
            {actions ? (
                <div className="flex flex-wrap justify-center gap-2">
                    {actions}
                </div>
            ) : null}
        </section>
    )
}
