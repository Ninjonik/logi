import { MobileActionBar } from "@/components/app/mobile-action-bar"
import { Badge } from "@/components/ui/badge"

/**
 * The top of a dashboard page (design frame): the title, a sentence on what
 * the page is for, and the page's actions on the right. On phones the main
 * action moves to a bar at the bottom of the screen.
 */
export function PageHeader({
    title,
    description,
    badge,
    badges,
    actions,
    primaryAction,
}: {
    title: string
    description?: string
    badge?: string
    badges?: React.ReactNode
    actions?: React.ReactNode
    /** The page's main action; on phones it moves to a bar at the bottom. */
    primaryAction?: React.ReactNode
}) {
    return (
        <div className="flex flex-col gap-3 px-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4 lg:px-6">
            <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                    <h1
                        data-page-title=""
                        className="text-2xl leading-8 font-semibold tracking-[-0.01em] text-balance"
                    >
                        {title}
                    </h1>
                    {badge ? (
                        <Badge
                            variant="secondary"
                            className="h-6 rounded-full px-2.5 text-xs font-medium"
                        >
                            {badge}
                        </Badge>
                    ) : null}
                    {badges}
                </div>
                {description ? (
                    <p className="text-muted-foreground max-w-3xl text-sm leading-[1.45]">
                        {description}
                    </p>
                ) : null}
            </div>
            {primaryAction ? (
                <div className="flex flex-wrap items-center gap-2">
                    {actions}
                    <MobileActionBar>{primaryAction}</MobileActionBar>
                </div>
            ) : actions ? (
                <div className="flex flex-wrap items-center gap-2">
                    {actions}
                </div>
            ) : null}
        </div>
    )
}
