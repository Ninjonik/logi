"use client"

import { AlertCircle, Copy } from "lucide-react"
import { useId, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type ErrorStateDetail = { label: string; value: string }

/**
 * A failed load (design K4): what happened, what to do next, a retry and
 * details the person can pass to support. Use it instead of a blank area or
 * a toast when content could not be shown.
 */
export function ErrorState({
    title,
    description,
    onRetry,
    retryLabel,
    details,
    detailsLabel,
    copyLabel,
    copiedLabel,
    className,
}: {
    title: string
    /** What happened and what was not affected, then the next step. */
    description: string
    onRetry?: () => void
    retryLabel: string
    /** Facts for support, such as an error reference, time and page. */
    details?: ErrorStateDetail[]
    detailsLabel: string
    copyLabel: string
    copiedLabel: string
    className?: string
}) {
    const [showDetails, setShowDetails] = useState(false)
    const detailsId = useId()
    const detailsText = details
        ?.map((detail) => `${detail.label}: ${detail.value}`)
        .join("\n")

    async function copyDetails() {
        if (!detailsText) return
        try {
            await navigator.clipboard.writeText(detailsText)
            toast.success(copiedLabel)
        } catch {
            setShowDetails(true)
        }
    }

    return (
        <section
            role="alert"
            className={cn(
                "border-status-danger-border bg-card flex flex-col gap-3 rounded-[14px] border p-5",
                className
            )}
        >
            <div className="flex items-start gap-2.5">
                <AlertCircle
                    aria-hidden="true"
                    className="text-status-danger mt-0.5 size-5 shrink-0"
                />
                <div className="flex min-w-0 flex-col gap-1">
                    <h2 className="text-[15px] font-semibold">{title}</h2>
                    <p className="text-foreground/80 text-sm leading-5">
                        {description}
                    </p>
                </div>
            </div>
            <div className="flex flex-wrap gap-2">
                {onRetry ? (
                    <Button
                        type="button"
                        size="sm"
                        className="rounded-lg"
                        onClick={onRetry}
                    >
                        {retryLabel}
                    </Button>
                ) : null}
                {details?.length ? (
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-lg"
                        aria-expanded={showDetails}
                        aria-controls={detailsId}
                        onClick={() => setShowDetails((open) => !open)}
                    >
                        {detailsLabel}
                    </Button>
                ) : null}
            </div>
            {details?.length && showDetails ? (
                <div
                    id={detailsId}
                    className="bg-muted flex flex-col gap-2 rounded-xl p-3"
                >
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                        {details.map((detail) => (
                            <div key={detail.label} className="contents">
                                <dt className="text-muted-foreground">
                                    {detail.label}
                                </dt>
                                <dd className="font-mono break-all">
                                    {detail.value}
                                </dd>
                            </div>
                        ))}
                    </dl>
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="w-fit rounded-lg"
                        onClick={() => void copyDetails()}
                    >
                        <Copy className="size-3.5" />
                        {copyLabel}
                    </Button>
                </div>
            ) : null}
        </section>
    )
}
