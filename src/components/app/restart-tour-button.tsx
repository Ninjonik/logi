"use client"

import type { ReactNode } from "react"

/** Starts the dashboard tour again (handled by DashboardOnboarding). */
export function RestartTourButton({
    children,
    className,
}: {
    children: ReactNode
    className?: string
}) {
    return (
        <button
            type="button"
            onClick={() =>
                window.dispatchEvent(new Event("logi:restart-onboarding"))
            }
            className={className}
        >
            {children}
        </button>
    )
}
