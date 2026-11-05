"use client"

import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"

type Delivery = {
    status: "pending" | "delivered" | "unavailable"
    href: string | null
}

/** Polls confirmed Discord message state; a slow worker is still pending. */
export function EventDeliveryStatus({
    serverId,
    eventId,
    dictionary,
}: {
    serverId: string
    eventId: string
    dictionary: Dictionary
}) {
    const [delivery, setDelivery] = useState<Delivery | null>(null)
    const [checkFailed, setCheckFailed] = useState(false)
    const [attempt, setAttempt] = useState(0)
    const t = dictionary.newMatch.delivery
    useEffect(() => {
        const controller = new AbortController()
        let timer: ReturnType<typeof setTimeout> | undefined
        let checks = 0
        async function check() {
            try {
                const response = await fetch(
                    `/api/servers/${serverId}/events/${eventId}/delivery`,
                    { cache: "no-store", signal: controller.signal }
                )
                if (!response.ok) throw new Error("Delivery status unavailable")
                const body: unknown = await response.json()
                if (
                    !body ||
                    typeof body !== "object" ||
                    !("status" in body) ||
                    !("href" in body)
                )
                    throw new Error("Invalid delivery status")
                if (
                    body.status !== "pending" &&
                    body.status !== "delivered" &&
                    body.status !== "unavailable"
                )
                    throw new Error("Invalid delivery status")
                const href =
                    typeof body.href === "string" &&
                    body.href.startsWith("https://discord.com/")
                        ? body.href
                        : null
                if (controller.signal.aborted) return
                setCheckFailed(false)
                setDelivery({ status: body.status, href })
                if (body.status !== "pending") return
            } catch {
                if (controller.signal.aborted) return
                setCheckFailed(true)
            }
            checks += 1
            if (checks < 24 && !controller.signal.aborted)
                timer = setTimeout(check, 5000)
        }
        void check()
        return () => {
            controller.abort()
            if (timer) clearTimeout(timer)
        }
    }, [serverId, eventId, attempt])
    return (
        <div className="border-border/60 bg-card mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-sm">
            <p role="status">
                {checkFailed
                    ? t.checkFailed
                    : delivery?.status === "delivered"
                      ? t.delivered
                      : delivery?.status === "unavailable"
                        ? t.unavailable
                        : t.pending}
            </p>
            {delivery?.href ? (
                <a
                    href={delivery.href}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                >
                    {t.open}
                </a>
            ) : (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAttempt((value) => value + 1)}
                >
                    {t.refresh}
                </Button>
            )}
        </div>
    )
}
