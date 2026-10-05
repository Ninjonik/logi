"use client"

import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

import { ConfirmActionDialog } from "@/components/app/confirm-action-dialog"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"

export function StratmapDeleteButton({
    serverId,
    stratmapId,
    stratmapTitle,
    linkedEventNames,
    listHref,
    dictionary,
}: {
    serverId: string
    stratmapId: string
    stratmapTitle: string
    /** Events that link the stratmap and lose the link when it is deleted. */
    linkedEventNames: string[]
    listHref: string
    dictionary: Dictionary
}) {
    const router = useRouter()
    const labels = dictionary.stratmaps

    async function remove() {
        const response = await fetch(
            `/api/servers/${serverId}/stratmaps/${encodeURIComponent(stratmapId)}`,
            { method: "DELETE" }
        ).catch(() => null)
        if (!response?.ok) {
            toast.error(labels.deleteFailed)
            return false
        }
        toast.success(labels.deleted)
        router.push(listHref)
        router.refresh()
    }

    return (
        <ConfirmActionDialog
            trigger={
                <Button variant="destructive" className="rounded-xl">
                    <Trash2 className="size-4" />
                    {labels.deleteAction}
                </Button>
            }
            title={labels.deleteTitle.replace("{title}", stratmapTitle)}
            description={labels.deleteDescription}
            confirmLabel={labels.deleteAction}
            cancelLabel={dictionary.common.cancel}
            onConfirm={remove}
        >
            {linkedEventNames.length ? (
                <div className="space-y-2 text-sm">
                    <p>{labels.deleteLinkedEvents}</p>
                    <ul className="border-border/60 max-h-40 list-inside list-disc overflow-y-auto rounded-xl border px-3 py-2">
                        {linkedEventNames.map((name, index) => (
                            <li
                                key={`${name}-${index}`}
                                className="break-words"
                            >
                                {name}
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
        </ConfirmActionDialog>
    )
}
