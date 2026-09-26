"use client"

import { useEffect, useState } from "react"

import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Hook = {
    id: string
    url: string
    enabled: boolean
    eventTypes: string[]
    lastDeliveredAt?: string
    lastFailureAt?: string
}
type Delivery = {
    id: string
    status: string
    attempt: number
    responseStatus?: number
    lastError?: string
    createdAt: string
    deliveredAt?: string
}
const eventTypes = [
    "event.created",
    "event.updated",
    "roster.updated",
    "article.created",
    "article.updated",
    "article.deleted",
    "settings.updated",
]

export function WebhookManager({
    serverId,
    dictionary,
}: {
    serverId: string
    dictionary: Dictionary
}) {
    const labels = dictionary.clan.webhookUi
    const [hooks, setHooks] = useState<Hook[]>([])
    const [url, setUrl] = useState("")
    const [secret, setSecret] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [history, setHistory] = useState<{
        webhookId: string
        deliveries: Delivery[]
    } | null>(null)
    const load = async () => {
        setLoading(true)
        try {
            const response = await fetch(`/api/servers/${serverId}/webhooks`)
            if (!response.ok) throw new Error("Unable to load webhooks.")
            setHooks((await response.json()).data)
        } catch (value) {
            setError(
                value instanceof Error
                    ? value.message
                    : "Unable to load webhooks."
            )
        } finally {
            setLoading(false)
        }
    }
    useEffect(() => {
        void load()
    }, [serverId])
    const create = async () => {
        setError(null)
        const response = await fetch(`/api/servers/${serverId}/webhooks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, eventTypes }),
        })
        const payload = await response.json()
        if (!response.ok) {
            setError(payload.error ?? "Unable to create webhook.")
            return
        }
        setSecret(payload.signingSecret)
        setUrl("")
        await load()
    }
    const send = async (
        hook: Hook,
        method: "PATCH" | "POST" | "DELETE",
        body?: object
    ) => {
        await fetch(`/api/servers/${serverId}/webhooks/${hook.id}`, {
            method,
            ...(body
                ? {
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(body),
                  }
                : {}),
        })
        await load()
    }
    const rotate = async (hook: Hook) => {
        setError(null)
        const response = await fetch(
            `/api/servers/${serverId}/webhooks/${hook.id}`,
            {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rotateSecret: true }),
            }
        )
        const payload = await response.json()
        if (!response.ok) {
            setError(payload.error ?? "Unable to rotate the signing secret.")
            return
        }
        setSecret(payload.signingSecret)
    }
    const loadHistory = async (hook: Hook) => {
        setError(null)
        const response = await fetch(
            `/api/servers/${serverId}/webhooks/${hook.id}/deliveries`
        )
        const payload = await response.json()
        if (!response.ok) {
            setError(payload.error ?? "Unable to load delivery history.")
            return
        }
        setHistory({ webhookId: hook.id, deliveries: payload.data })
    }
    return (
        <div className="space-y-4">
            {secret ? (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                    {labels.copySecret}{" "}
                    <code className="break-all">{secret}</code>
                </div>
            ) : null}
            <div className="flex gap-2">
                <Input
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="https://example.com/logi-webhook"
                    aria-label={labels.url}
                />
                <Button type="button" onClick={() => void create()}>
                    {labels.add}
                </Button>
            </div>
            {error ? (
                <p className="text-destructive text-sm" role="alert">
                    {error}
                </p>
            ) : null}
            {loading ? (
                <p className="text-muted-foreground text-sm" aria-live="polite">
                    {labels.loading}
                </p>
            ) : null}
            {hooks.map((hook) => (
                <div
                    key={hook.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"
                >
                    <div>
                        <p className="font-medium break-all">{hook.url}</p>
                        <p className="text-muted-foreground">
                            {hook.enabled ? labels.enabled : labels.disabled} ·{" "}
                            {hook.eventTypes.length} {labels.eventTypes}
                        </p>
                        <p className="text-muted-foreground">
                            {labels.lastDelivery}:{" "}
                            {hook.lastDeliveredAt ?? labels.never} ·
                            {labels.lastFailure}:{" "}
                            {hook.lastFailureAt ?? labels.never}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                void send(hook, "PATCH", {
                                    enabled: !hook.enabled,
                                })
                            }
                        >
                            {hook.enabled ? labels.disable : labels.enable}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void send(hook, "POST")}
                        >
                            {labels.sendTest}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void rotate(hook)}
                        >
                            {labels.rotate}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void loadHistory(hook)}
                        >
                            {labels.history}
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => void send(hook, "DELETE")}
                        >
                            {labels.delete}
                        </Button>
                    </div>
                </div>
            ))}
            {history ? (
                <div className="overflow-x-auto rounded-lg border p-3 text-sm">
                    <h3 className="mb-2 font-medium">{labels.historyTitle}</h3>
                    {history.deliveries.length === 0 ? (
                        <p className="text-muted-foreground">
                            {labels.noHistory}
                        </p>
                    ) : (
                        <table className="w-full text-left">
                            <thead>
                                <tr>
                                    <th>{labels.status}</th>
                                    <th>{labels.attempt}</th>
                                    <th>{labels.response}</th>
                                    <th>{labels.created}</th>
                                    <th>{labels.error}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.deliveries.map((delivery) => (
                                    <tr key={delivery.id}>
                                        <td>{delivery.status}</td>
                                        <td>{delivery.attempt}</td>
                                        <td>
                                            {delivery.responseStatus ?? "—"}
                                        </td>
                                        <td>{delivery.createdAt}</td>
                                        <td>{delivery.lastError ?? "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            ) : null}
        </div>
    )
}
