import type { ReactNode } from "react"

/**
 * Title of one settings page (design A2): the name, what the page is for, an
 * optional action on the right (a switch or the page's main button) and an
 * optional legend line underneath.
 */
export function SettingsSectionHeader({
    title,
    description,
    actions,
    legend,
}: {
    title: string
    description?: string
    actions?: ReactNode
    legend?: ReactNode
}) {
    return (
        <div className="space-y-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                    <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px] sm:leading-9">
                        {title}
                    </h1>
                    {description ? (
                        <p className="text-muted-foreground text-sm sm:text-[15px]">
                            {description}
                        </p>
                    ) : null}
                </div>
                {actions ? (
                    <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pt-1">
                        {actions}
                    </div>
                ) : null}
            </div>
            {legend}
        </div>
    )
}
