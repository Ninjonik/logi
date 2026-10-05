import { Circle } from "lucide-react"
import Link from "next/link"

import { defaultLocale, type Locale } from "@/i18n/config"
import { getDictionary } from "@/i18n/dictionaries"
import type { LogiStatus } from "@/lib/logi-status"

const statusClassName = {
    operational: "text-emerald-600 dark:text-emerald-400",
    degraded: "text-amber-600 dark:text-amber-400",
    unknown: "text-muted-foreground",
} as const

/**
 * The overall service status as a link: to the external status monitor when
 * `NEXT_PUBLIC_LOGI_STATUS_URL` is set, otherwise to Logi's own status page
 * in the given language. Without either there is nowhere to link to.
 */
export function LogiStatusLink({
    status,
    showLabel = true,
    locale,
}: {
    status: LogiStatus
    showLabel?: boolean
    locale?: Locale
}) {
    const labels = getDictionary(locale ?? defaultLocale).publicSite.status
    const label = labels[status]
    const className = `${statusClassName[status]} inline-flex items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-80`
    const content = (
        <>
            <Circle className="size-2.5 fill-current" aria-hidden="true" />
            {showLabel ? <span>{label}</span> : null}
        </>
    )
    const external = process.env.NEXT_PUBLIC_LOGI_STATUS_URL
    if (external)
        return (
            <a
                href={external}
                className={className}
                aria-label={label}
                title={label}
            >
                {content}
            </a>
        )
    if (!locale) return null
    return (
        <Link
            href={`/${locale}/status`}
            className={className}
            aria-label={label}
            title={label}
        >
            {content}
        </Link>
    )
}
