"use client"

import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

import { ConfirmActionDialog } from "@/components/app/confirm-action-dialog"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"

/** Deletes a squad or topic preset after a confirmation that names the consequences. */
export function PresetDeleteButton({
    serverId,
    locale,
    kind,
    presetId,
    presetName,
    dictionary,
}: {
    serverId: string
    locale: string
    kind: "squad" | "topic"
    presetId: string
    presetName: string
    dictionary: Dictionary
}) {
    const router = useRouter()
    const text = dictionary.presets.delete
    const path = kind === "squad" ? "squad-presets" : "topic-presets"

    async function remove() {
        const response = await fetch(
            `/api/servers/${serverId}/${path}/${presetId}`,
            { method: "DELETE" }
        ).catch(() => null)
        const body = (await response?.json().catch(() => null)) as {
            error?: string
            eventCount?: number
        } | null
        if (!response?.ok) {
            toast.error(
                body?.error === "in_use"
                    ? text.inUse.replace(
                          "{count}",
                          String(body.eventCount ?? 1)
                      )
                    : response?.status === 403
                      ? text.forbidden
                      : text.failed
            )
            return false
        }
        toast.success(text.done)
        router.push(`/${locale}/dashboard/servers/${serverId}/${path}`)
        router.refresh()
    }

    return (
        <ConfirmActionDialog
            trigger={
                <Button
                    type="button"
                    variant="outline"
                    className="text-destructive rounded-xl"
                >
                    <Trash2 className="size-4" aria-hidden="true" />
                    {text.action}
                </Button>
            }
            title={text.title.replace("{name}", presetName)}
            description={
                kind === "squad" ? text.squadConsequence : text.topicConsequence
            }
            confirmLabel={text.confirm}
            cancelLabel={dictionary.common.cancel}
            onConfirm={remove}
        />
    )
}
