"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { z } from "zod"

import {
    verifiedPlatformLinkSchema,
    type LinkLocale,
    type VerifiedPlatformLink,
} from "@/domain/identity/platform-link"
import type { Dictionary } from "@/i18n/dictionaries"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"

/** "2. 10." in Czech; the year only when it is not the current one. */
function shortDate(timestamp: number, locale: LinkLocale) {
    const date = new Date(timestamp)
    return date.toLocaleDateString(locale, {
        day: "numeric",
        month: "numeric",
        ...(date.getFullYear() === new Date().getFullYear()
            ? {}
            : { year: "numeric" }),
    })
}

/**
 * The verified Steam account as one row of "Game accounts" (design K1):
 * verified with its date and an unlink action, or a prompt to verify.
 */
export function VerifiedPlatformLinks({
    dictionary,
    locale,
    initialCallbackFailed = false,
}: {
    dictionary: Dictionary
    locale: LinkLocale
    initialCallbackFailed?: boolean
}) {
    const t = dictionary.verifiedPlatformLinks
    const account = dictionary.userSettings
    const [data, setData] = useState<VerifiedPlatformLink[] | null>(null)
    const [error, setError] = useState(false),
        [busy, setBusy] = useState(true),
        [refresh, setRefresh] = useState(0)
    const [callbackFailed, setCallbackFailed] = useState(initialCallbackFailed)
    useEffect(() => {
        const controller = new AbortController()
        void fetch("/api/platform-links/steam", {
            cache: "no-store",
            signal: controller.signal,
        })
            .then(async (response) => {
                if (!response.ok) throw new Error()
                const result = z
                    .array(verifiedPlatformLinkSchema)
                    .max(20)
                    .parse(await response.json())
                if (!controller.signal.aborted) {
                    setData(result)
                    setError(false)
                }
            })
            .catch(() => {
                if (!controller.signal.aborted) {
                    setData(null)
                    setError(true)
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) setBusy(false)
            })
        return () => controller.abort()
    }, [refresh])
    const active = data?.find((link) => link.revokedAt === null)
    const reload = () => {
        setData(null)
        setBusy(true)
        setRefresh((n) => n + 1)
    }
    async function start() {
        setBusy(true)
        setError(false)
        setCallbackFailed(false)
        try {
            const response = await fetch("/api/platform-links/steam/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ locale }),
            })
            if (!response.ok) throw new Error()
            const { redirectUrl } = z
                .object({ redirectUrl: z.string().url() })
                .parse(await response.json())
            const url = new URL(redirectUrl)
            if (
                url.origin !== "https://steamcommunity.com" ||
                url.pathname !== "/openid/login"
            )
                throw new Error()
            window.location.assign(url.toString())
        } catch {
            setError(true)
            setBusy(false)
        }
    }
    async function unlink() {
        setBusy(true)
        setError(false)
        try {
            const response = await fetch("/api/platform-links/steam", {
                method: "DELETE",
            })
            if (!response.ok) throw new Error()
            toast.success(account.steamUnlinked)
            reload()
        } catch {
            setError(true)
            setBusy(false)
        }
    }
    const revoked = data?.filter((link) => link.revokedAt !== null) ?? []

    return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 border-t py-3.5">
            <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
                <span className="text-sm font-medium">Steam</span>
                {data === null && !error ? (
                    <Skeleton className="h-4 w-56 max-w-full" />
                ) : error ? (
                    <span role="alert" className="text-status-danger text-sm">
                        {account.steamUnavailable}
                    </span>
                ) : active ? (
                    <span
                        className="text-status-success text-[13px] leading-5"
                        title={active.platformId}
                    >
                        {account.steamVerifiedOn.replace(
                            "{date}",
                            shortDate(active.verifiedAt, locale)
                        )}
                    </span>
                ) : (
                    <span className="text-muted-foreground text-[13px] leading-5">
                        {account.steamNotVerified}
                    </span>
                )}
                {callbackFailed ? (
                    <span role="alert" className="text-status-danger text-sm">
                        {t.callbackFailed}
                    </span>
                ) : null}
                {revoked.length ? (
                    <details className="text-muted-foreground mt-1 text-xs">
                        <summary className="cursor-pointer">
                            {t.history}
                        </summary>
                        <ul className="mt-1.5 space-y-1">
                            {revoked.map((link) => (
                                <li
                                    key={`${link.platformId}:${link.verifiedAt}`}
                                    className="break-words"
                                >
                                    <span className="font-mono">
                                        {link.platformId}
                                    </span>{" "}
                                    · {t.revokedAt}:{" "}
                                    {link.revokedAt
                                        ? new Date(
                                              link.revokedAt
                                          ).toLocaleString(locale)
                                        : null}
                                </li>
                            ))}
                        </ul>
                    </details>
                ) : null}
            </div>
            {error ? (
                <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    disabled={busy}
                    onClick={reload}
                >
                    {dictionary.appStates.retry}
                </Button>
            ) : data ? (
                <Button
                    variant={active ? "outline" : "default"}
                    size="sm"
                    className="rounded-lg"
                    disabled={busy}
                    onClick={active ? unlink : start}
                >
                    {active ? account.steamUnlink : account.steamVerify}
                </Button>
            ) : null}
        </div>
    )
}
