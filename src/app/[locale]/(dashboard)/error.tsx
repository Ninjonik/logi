"use client"

import { RouteError } from "@/components/app/route-error"

/** A dashboard page failed; the sidebar and header stay usable around it. */
export default function DashboardError({
    error,
    retry,
}: {
    error: Error & { digest?: string }
    retry: () => void
}) {
    return (
        <div className="px-4 py-6 lg:px-6">
            <RouteError
                error={error}
                retry={retry}
                className="mx-auto max-w-2xl"
            />
        </div>
    )
}
