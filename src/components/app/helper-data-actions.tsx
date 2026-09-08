"use client"

import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useTransition } from "react"
import { toast } from "sonner"

import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"

export function HelperDataActions({
    serverId,
    dictionary,
}: {
    serverId: string
    dictionary: Dictionary
}) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()

    async function run(action: "initialize" | "reset", confirmation: string) {
        if (!window.confirm(confirmation)) {
            return
        }

        const response = await fetch(`/api/servers/${serverId}/helper-data`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({ action }),
        })

        if (!response.ok) {
            toast.error(dictionary.common.error)
            return
        }

        toast.success(
            action === "initialize"
                ? dictionary.groups.initializeSuccess
                : dictionary.groups.resetSuccess
        )

        startTransition(() => {
            router.refresh()
        })
    }

    return (
        <div className="flex flex-wrap gap-3">
            <Button
                variant="outline"
                className="rounded-xl"
                disabled={isPending}
                onClick={() =>
                    run("initialize", dictionary.groups.initializeConfirm)
                }
            >
                {isPending ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                {dictionary.groups.initialize}
            </Button>
            <Button
                variant="destructive"
                className="rounded-xl"
                disabled={isPending}
                onClick={() => run("reset", dictionary.groups.resetConfirm)}
            >
                {isPending ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                {dictionary.groups.reset}
            </Button>
        </div>
    )
}
