"use client"

import {
    verifiedPlatformLinkSchema,
    type LinkLocale,
    type VerifiedPlatformLink,
} from "@/domain/identity/platform-link"
import type { Dictionary } from "@/i18n/dictionaries"
import { useEffect, useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { z } from "zod"

export function VerifiedPlatformLinks({
    dictionary,
    locale,
    initialCallbackFailed = false,
}: {
    dictionary: Dictionary
    locale: LinkLocale
    initialCallbackFailed?: boolean
}) {
    const t = dictionary.verifiedPlatformLinks,
        heading = useId()
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
            reload()
        } catch {
            setError(true)
            setBusy(false)
        }
    }
    return (
        <section
            className="space-y-4 rounded-2xl border p-5"
            aria-labelledby={heading}
            aria-busy={busy}
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 id={heading} className="font-semibold">
                    {t.title}
                </h3>
                <Button variant="outline" disabled={busy} onClick={reload}>
                    {busy ? t.loading : t.refresh}
                </Button>
            </div>
            <p className="text-muted-foreground text-sm">{t.description}</p>
            {error && (
                <p role="alert" className="text-destructive text-sm">
                    {t.error}
                </p>
            )}
            {callbackFailed && (
                <p role="alert" className="text-destructive text-sm">
                    {t.callbackFailed}
                </p>
            )}
            {data && (
                <>
                    <div className="space-y-2 rounded-xl border p-3">
                        <p className="font-medium" role="status">
                            {active ? t.verified : t.empty}
                        </p>
                        {active && (
                            <>
                                <p className="font-mono text-sm break-all">
                                    {active.platformId}
                                </p>
                                <p className="text-muted-foreground text-sm">
                                    {t.verifiedAt}:{" "}
                                    {new Date(active.verifiedAt).toLocaleString(
                                        locale
                                    )}
                                </p>
                            </>
                        )}
                        <Button
                            disabled={busy}
                            variant={active ? "outline" : "default"}
                            onClick={active ? unlink : start}
                        >
                            {active ? t.unlink : t.link}
                        </Button>
                    </div>
                    <p className="text-muted-foreground text-sm">{t.effect}</p>
                    {data.some((link) => link.revokedAt !== null) && (
                        <details className="rounded-xl border p-3 text-sm">
                            <summary className="cursor-pointer font-medium">
                                {t.history}
                            </summary>
                            <ul className="mt-3 space-y-2">
                                {data
                                    .filter((link) => link.revokedAt !== null)
                                    .map((link) => (
                                        <li
                                            key={`${link.platformId}:${link.verifiedAt}`}
                                            className="break-words"
                                        >
                                            <span className="font-mono">
                                                {link.platformId}
                                            </span>{" "}
                                            · {t.revokedAt}:{" "}
                                            {new Date(
                                                link.revokedAt!
                                            ).toLocaleString(locale)}
                                        </li>
                                    ))}
                            </ul>
                        </details>
                    )}
                </>
            )}
        </section>
    )
}
