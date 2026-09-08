"use client"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { Loader2, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"

export function SeedEclButton({ dictionary }: { dictionary: Dictionary }) {
    const [pending, start] = useTransition()
    const router = useRouter()
    const labels = dictionary.competition
    return (
        <Button
            onClick={() =>
                start(async () => {
                    const response = await fetch("/api/competitions/ecl/seed", {
                        method: "POST",
                    })
                    if (!response.ok) {
                        toast.error(labels.createFailed)
                        return
                    }
                    toast.success(labels.createSuccess)
                    router.refresh()
                })
            }
            disabled={pending}
        >
            <>
                {pending ? (
                    <Loader2 className="size-4 animate-spin" />
                ) : (
                    <Plus className="size-4" />
                )}{" "}
                {labels.createEcl}
            </>
        </Button>
    )
}
