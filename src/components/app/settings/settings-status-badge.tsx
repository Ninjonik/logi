import { CircleAlert, CircleCheck, CircleDashed } from "lucide-react"

import type { SettingsSectionState } from "@/domain/workspaces/settings-sections"
import type { Dictionary } from "@/i18n/dictionaries"
import { cn } from "@/lib/utils"

const tones = {
    ready: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
    attention:
        "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100",
    off: "border-border bg-muted text-muted-foreground",
} as const
const icons = { ready: CircleCheck, attention: CircleAlert, off: CircleDashed }

export function SettingsStatusBadge({
    state,
    dictionary,
    className,
}: {
    state: SettingsSectionState
    dictionary: Dictionary
    className?: string
}) {
    if (state === "none") return null
    const Icon = icons[state]
    return (
        <span
            className={cn(
                "inline-flex h-6 shrink-0 items-center gap-1 rounded-md border px-2 text-xs font-medium",
                tones[state],
                className
            )}
        >
            <Icon className="size-3.5" aria-hidden="true" />
            {dictionary.settingsHub.status[state]}
        </span>
    )
}
