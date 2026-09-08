import {
    ArrowDownRight,
    ArrowUpRight,
    Crosshair,
    ShieldPlus,
    Swords,
} from "lucide-react"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import type { PerformanceSnapshot } from "@/lib/read-models/performance-history"
import type { Dictionary } from "@/i18n/dictionaries"

export function PlayerTrendIndicators({
    matches,
    dictionary,
}: {
    matches: PerformanceSnapshot[]
    dictionary: Dictionary
}) {
    const recent = matches.slice(0, 5),
        previous = matches.slice(5, 10)
    if (!previous.length)
        return <span className="text-muted-foreground text-xs">—</span>
    const metrics: Array<
        ["kd" | "offense" | "support", string, typeof Swords]
    > = [
        ["kd", dictionary.clan.kd, Swords],
        ["offense", dictionary.clan.combatEffectiveness, Crosshair],
        ["support", dictionary.clan.supportEffectiveness, ShieldPlus],
    ]
    return (
        <div className="flex flex-wrap gap-x-2 gap-y-1">
            {metrics.map(([key, label, MetricIcon]) => {
                const average = (rows: PerformanceSnapshot[]) =>
                    rows.reduce((total, row) => total + row[key], 0) /
                    rows.length
                const rawDelta = average(recent) - average(previous)
                const delta =
                    key === "kd"
                        ? Number(rawDelta.toFixed(2))
                        : Math.round(rawDelta)
                const formattedDelta =
                    key === "kd"
                        ? `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}`
                        : `${delta >= 0 ? "+" : ""}${delta}`
                const Icon = delta >= 0 ? ArrowUpRight : ArrowDownRight
                return (
                    <Tooltip key={key}>
                        <TooltipTrigger asChild>
                            <span
                                className={
                                    delta >= 0
                                        ? "flex items-center text-xs font-medium text-emerald-600 dark:text-emerald-400"
                                        : "flex items-center text-xs font-medium text-rose-600 dark:text-rose-400"
                                }
                            >
                                <MetricIcon className="size-3" />
                                <Icon className="size-3" />
                                {formattedDelta}
                            </span>
                        </TooltipTrigger>
                        <TooltipContent>{label}</TooltipContent>
                    </Tooltip>
                )
            })}
        </div>
    )
}
