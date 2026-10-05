"use client"

import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

import { ConfirmActionDialog } from "@/components/app/confirm-action-dialog"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"

export function ArticleDeleteButton({
    serverId,
    articleId,
    articleTitle,
    listHref,
    dictionary,
}: {
    serverId: string
    articleId: string
    articleTitle: string
    listHref: string
    dictionary: Dictionary
}) {
    const router = useRouter()
    const labels = dictionary.articles

    async function remove() {
        const response = await fetch(
            `/api/servers/${serverId}/articles/${encodeURIComponent(articleId)}`,
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
            title={labels.deleteTitle.replace("{title}", articleTitle)}
            description={labels.deleteDescription}
            confirmLabel={labels.deleteAction}
            cancelLabel={dictionary.common.cancel}
            onConfirm={remove}
        />
    )
}
