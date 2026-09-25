import { Circle } from "lucide-react"

import type { LogiStatus } from "@/lib/logi-status"

const statusDetails = {
    operational: {
        label: "All services operational",
        className: "text-emerald-600 dark:text-emerald-400",
    },
    degraded: {
        label: "Some services are degraded",
        className: "text-amber-600 dark:text-amber-400",
    },
    unknown: {
        label: "Service status unavailable",
        className: "text-muted-foreground",
    },
} as const

export function LogiStatusLink({ status }: { status: LogiStatus }) {
    const details = statusDetails[status]
    const href = process.env.NEXT_PUBLIC_LOGI_STATUS_URL

    if (!href) return null

    return (
        <a
            href={href}
            className={`${details.className} inline-flex items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-80`}
        >
            <Circle className="size-2.5 fill-current" aria-hidden="true" />
            <span>{details.label}</span>
        </a>
    )
}
