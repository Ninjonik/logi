"use client"
import type { Dictionary } from "@/i18n/dictionaries"
import type { GameId } from "@/domain/games/game"
import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"

export function RefreshPerformanceHistoryButton({
    serverId,
    dictionary,
    gameId,
}: {
    serverId: string
    dictionary: Dictionary
    gameId: GameId
}) {
    const router = useRouter()
    const [pending, startTransition] = useTransition()
    return (
        <Button
            variant="outline"
            className="rounded-xl"
            disabled={pending}
            onClick={() =>
                startTransition(async () => {
                    const response = await fetch(
                        `/api/servers/${serverId}/performance-history`,
                        {
                            method: "POST",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({ gameId }),
                        }
                    )
                    if (!response.ok) {
                        toast.error(
                            dictionary.userManagement
                                .refreshPerformanceHistoryError
                        )
                        return
                    }
                    toast.success(
                        dictionary.userManagement
                            .refreshPerformanceHistorySuccess
                    )
                    router.refresh()
                })
            }
        >
            {pending ? (
                <Loader2 className="size-4 animate-spin" />
            ) : (
                <RefreshCw className="size-4" />
            )}
            {dictionary.userManagement.refreshPerformanceHistory}
        </Button>
    )
}
