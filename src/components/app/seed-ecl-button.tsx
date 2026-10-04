"use client"
import { competitionErrorCode } from "@/lib/competitions/competition-client"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { Loader2, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"

/** Creates or completes ECL 2026 with global catalogue teams. */
export function SeedEclButton({ dictionary }: { dictionary: Dictionary }) {
    const [pending, start] = useTransition()
    const router = useRouter()
    const labels = dictionary.competition
    return (
        <Button
            variant="outline"
            onClick={() =>
                start(async () => {
                    const response = await fetch("/api/competitions/ecl/seed", {
                        method: "POST",
                    }).catch(() => null)
                    if (!response?.ok) {
                        const body = await response?.json().catch(() => null)
                        toast.error(
                            `${labels.createFailed} ${dictionary.competitionAdmin.errors[competitionErrorCode(body)]}`
                        )
                        return
                    }
                    toast.success(labels.createSuccess)
                    router.refresh()
                })
            }
            disabled={pending}
        >
            {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
                <Plus className="size-4" aria-hidden />
            )}
            {labels.createEcl}
        </Button>
    )
}
