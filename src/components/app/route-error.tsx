"use client"

import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

import { ErrorState } from "@/components/app/error-state"

/**
 * The page-level error boundary content for `error.tsx` files: the shared
 * error state with retry and the details support needs (reference, time,
 * page). Server errors only expose their digest, never their message.
 */
export function RouteError({
    error,
    retry,
    className,
}: {
    error: Error & { digest?: string }
    retry: () => void
    className?: string
}) {
    const t = useTranslations("appStates")
    const pathname = usePathname()
    const [time] = useState(() => new Date().toISOString())

    useEffect(() => {
        console.error(error)
    }, [error])

    return (
        <ErrorState
            className={className}
            title={t("errorTitle")}
            description={`${t("errorDescription")} ${t("errorNextStep")}`}
            onRetry={retry}
            retryLabel={t("retry")}
            details={[
                ...(error.digest
                    ? [{ label: t("errorReference"), value: error.digest }]
                    : []),
                { label: t("errorTime"), value: time },
                ...(pathname
                    ? [{ label: t("errorPage"), value: pathname }]
                    : []),
            ]}
            detailsLabel={t("supportDetails")}
            copyLabel={t("copyDetails")}
            copiedLabel={t("detailsCopied")}
        />
    )
}
