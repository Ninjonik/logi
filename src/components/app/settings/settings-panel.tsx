import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/** One titled block of a settings page (designs D4, G2, G3). */
export function SettingsPanel({
    id,
    title,
    description,
    actions,
    children,
    className,
}: {
    id: string
    title: ReactNode
    description?: ReactNode
    actions?: ReactNode
    children: ReactNode
    className?: string
}) {
    return (
        <section
            aria-labelledby={id}
            className={cn(
                "bg-card space-y-4 rounded-2xl border p-5 sm:p-6",
                className
            )}
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                    <h2 id={id} className="text-base font-semibold">
                        {title}
                    </h2>
                    {description ? (
                        <p className="text-muted-foreground text-sm">
                            {description}
                        </p>
                    ) : null}
                </div>
                {actions}
            </div>
            {children}
        </section>
    )
}

/** A setting with its label and help on the left and the control on the right. */
export function SettingsField({
    label,
    help,
    children,
}: {
    label: ReactNode
    help?: ReactNode
    children: ReactNode
}) {
    return (
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-start md:gap-6">
            <div className="min-w-0 space-y-1">
                <div className="text-sm font-medium">{label}</div>
                {help ? (
                    <div className="text-muted-foreground text-[13px] leading-5">
                        {help}
                    </div>
                ) : null}
            </div>
            <div className="min-w-0">{children}</div>
        </div>
    )
}
