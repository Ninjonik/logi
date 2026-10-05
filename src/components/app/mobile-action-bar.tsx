import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * A page's main action (design K2): on phones it sits in a bar at the bottom
 * of the screen, within reach of the thumb; from `sm` up it stays where it is
 * rendered, for example among the page header actions. The dashboard frame
 * adds room below the content while a bar is on the page.
 */
export function MobileActionBar({
    children,
    status,
    className,
}: {
    children: ReactNode
    /** Optional short state shown beside the action on phones, such as "1 change". */
    status?: ReactNode
    className?: string
}) {
    return (
        <div
            data-mobile-action-bar=""
            className={cn(
                "max-sm:bg-background max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:z-30 max-sm:flex max-sm:items-center max-sm:gap-2.5 max-sm:border-t max-sm:px-3.5 max-sm:pt-3 max-sm:pb-[max(1.125rem,env(safe-area-inset-bottom))] sm:contents",
                "max-sm:[&>a]:h-12 max-sm:[&>a]:flex-1 max-sm:[&>button]:h-12 max-sm:[&>button]:flex-1",
                className
            )}
        >
            {status ? (
                <span className="text-muted-foreground flex-1 text-[13px] sm:hidden">
                    {status}
                </span>
            ) : null}
            {children}
        </div>
    )
}
