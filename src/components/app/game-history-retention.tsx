"use client"

import {
    HISTORY_RETENTION_DAYS,
    historyRetentionSettingsSchema,
    type HistoryRetentionSettings,
} from "@/domain/game-data/history-retention"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { SettingsField } from "@/components/app/settings/settings-panel"
import { useCallback, useEffect, useId, useState } from "react"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"

type Props = { serverId: string; dictionary: Dictionary }
const INDEFINITE = "indefinite"

export function GameHistoryRetention(props: Props) {
    return <Retention key={props.serverId} {...props} />
}

function Retention({ serverId, dictionary }: Props) {
    const t = dictionary.gameHistory,
        row = dictionary.gameData.servers.card,
        id = useId()
    const url = `/api/servers/${encodeURIComponent(serverId)}/game-history-retention`
    const [stored, setStored] = useState<HistoryRetentionSettings | null>(null)
    const [choice, setChoice] = useState(INDEFINITE)
    const [loading, setLoading] = useState(true),
        [pending, setPending] = useState(false),
        [error, setError] = useState(false),
        [saved, setSaved] = useState(false)
    const load = useCallback(
        async (signal?: AbortSignal) => {
            const response = await fetch(url, { cache: "no-store", signal })
            if (!response.ok) throw new Error()
            const body = (await response.json()) as { retentionDays?: unknown }
            const value = historyRetentionSettingsSchema.parse({
                retentionDays: body.retentionDays ?? null,
            })
            if (signal?.aborted) return
            setStored(value)
            setChoice(
                value.retentionDays === null
                    ? INDEFINITE
                    : String(value.retentionDays)
            )
        },
        [url]
    )
    useEffect(() => {
        const controller = new AbortController()
        void load(controller.signal)
            .catch(() => {
                if (!controller.signal.aborted) setError(true)
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false)
            })
        return () => controller.abort()
    }, [load])

    async function save() {
        const input = historyRetentionSettingsSchema.safeParse({
            retentionDays: choice === INDEFINITE ? null : Number(choice),
        })
        if (!input.success) {
            setError(true)
            return
        }
        setPending(true)
        setError(false)
        setSaved(false)
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(input.data),
            })
            if (!response.ok) throw new Error()
            await load()
            setSaved(true)
        } catch {
            setError(true)
        } finally {
            setPending(false)
        }
    }

    const busy = loading || pending
    const dirty =
        stored !== null &&
        choice !==
            (stored.retentionDays === null
                ? INDEFINITE
                : String(stored.retentionDays))
    return (
        <div className="py-4">
            <SettingsField
                label={<span id={`${id}-title`}>{row.retentionKeep}</span>}
                help={row.retentionHelp}
            >
                <div className="flex flex-wrap items-center gap-2">
                    <Select
                        value={choice}
                        onValueChange={(value) => {
                            setSaved(false)
                            setChoice(value)
                        }}
                        disabled={busy}
                    >
                        <SelectTrigger
                            id={`${id}-select`}
                            aria-labelledby={`${id}-title`}
                            className="min-w-0 flex-1 rounded-lg"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={INDEFINITE}>
                                {t.retentionIndefinite}
                            </SelectItem>
                            {HISTORY_RETENTION_DAYS.map((days) => (
                                <SelectItem key={days} value={String(days)}>
                                    {t.retentionDays.replace(
                                        "{days}",
                                        String(days)
                                    )}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {dirty || pending ? (
                        <Button
                            className="rounded-lg"
                            disabled={busy || !dirty}
                            onClick={save}
                        >
                            {pending ? t.retentionSaving : t.retentionSave}
                        </Button>
                    ) : null}
                </div>
                {error && (
                    <p role="alert" className="text-destructive mt-2 text-sm">
                        {t.retentionError}
                    </p>
                )}
                {saved && (
                    <p role="status" className="mt-2 text-sm">
                        {t.retentionSaved}
                    </p>
                )}
            </SettingsField>
        </div>
    )
}
