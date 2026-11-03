"use client"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import type { WorkspaceMode as Mode } from "@/domain/competitions/enrollment"
import { useId, useState, useTransition } from "react"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"

export function WorkspaceMode({
    serverId,
    mode,
    dictionary,
}: {
    serverId: string
    mode?: Mode
    dictionary: Dictionary
}) {
    const t = dictionary.competitionEnrollment
    const router = useRouter()
    const id = useId()
    const [choice, setChoice] = useState<Mode>(mode ?? "full")
    const [saved, setSaved] = useState(false)
    const [busy, setBusy] = useState(false)
    const [refreshing, startTransition] = useTransition()
    const [error, setError] = useState(false)
    async function save() {
        setBusy(true)
        setError(false)
        try {
            const response = await fetch(
                `/api/servers/${encodeURIComponent(serverId)}/workspace-mode`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ mode: choice }),
                }
            )
            if (!response.ok) setError(true)
            else {
                setSaved(true)
                window.dispatchEvent(
                    new CustomEvent("logi:workspace-mode", {
                        detail: { serverId, mode: choice },
                    })
                )
                startTransition(() => router.refresh())
            }
        } catch {
            setError(true)
        } finally {
            setBusy(false)
        }
    }
    return (
        <div
            data-tour-workspace-mode=""
            className="mb-5 flex flex-wrap items-center gap-3 text-sm"
        >
            <Label htmlFor={id}>{t.modeLabel}</Label>
            <p id={`${id}-description`} className="sr-only">
                {t.modeDescription}
            </p>
            <Select
                value={choice}
                disabled={busy || refreshing}
                onValueChange={(value) => {
                    if (value !== "full" && value !== "competitions") return
                    setChoice(value)
                    setSaved(false)
                    setError(false)
                }}
            >
                <SelectTrigger
                    id={id}
                    size="sm"
                    aria-describedby={`${id}-description`}
                    className="w-44"
                >
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {(["full", "competitions"] as const).map((value) => (
                        <SelectItem key={value} value={value}>
                            {t[value]}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Button
                size="sm"
                variant="outline"
                disabled={busy || refreshing}
                onClick={() => void save()}
            >
                {t.modeSave}
            </Button>
            {error && (
                <p role="alert" className="text-destructive">
                    {t.error}
                </p>
            )}
            {saved && (
                <p role="status" className="text-muted-foreground">
                    {t.saved}
                </p>
            )}
        </div>
    )
}
