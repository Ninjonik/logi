"use client"

import {
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts"
import type { PerformanceSnapshot } from "@/lib/read-models/performance-history"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"
import type { Dictionary } from "@/i18n/dictionaries"

type ChartKind =
    "effectiveness" | "playerEffectiveness" | "combat" | "points" | "kd"

function PerformanceTooltip({
    active,
    label,
    payload,
    matches,
    fallbackLabel,
}: {
    active?: boolean
    label?: string | number
    payload?: ReadonlyArray<{
        name?: string
        value?: string | number
        color?: string
    }>
    matches: PerformanceSnapshot[]
    fallbackLabel: string
}) {
    if (!active || !payload?.length) return null
    const match =
        typeof label === "number" ? matches[Number(label) - 1] : undefined
    return (
        <div className="border-border bg-popover text-popover-foreground min-w-40 rounded-xl border px-3 py-2 text-sm shadow-lg">
            <p className="mb-2 font-medium">
                {match?.label ?? `${fallbackLabel} ${label ?? ""}`}
            </p>
            <div className="space-y-1">
                {payload.map((item) => (
                    <div
                        key={item.name}
                        className="flex items-center justify-between gap-5"
                    >
                        <span className="text-muted-foreground flex items-center gap-2">
                            <span
                                className="size-2 rounded-full"
                                style={{ backgroundColor: item.color }}
                            />
                            {item.name}
                        </span>
                        <span className="font-medium tabular-nums">
                            {item.value}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}

export function PerformanceHistoryChart({
    title,
    matches,
    dictionary,
    kind = "effectiveness",
}: {
    title: string
    matches: PerformanceSnapshot[]
    dictionary: Dictionary
    kind?: ChartKind
}) {
    const data = [...matches]
        .reverse()
        .map((match, index) => ({ ...match, match: index + 1 }))
    const recent = matches.slice(0, 5),
        previous = matches.slice(5, 10)
    const field =
        kind === "points"
            ? "points"
            : kind === "kd"
              ? "kd"
              : kind === "combat"
                ? "kd"
                : "combat"
    const average = (rows: PerformanceSnapshot[]) =>
        rows.length
            ? rows.reduce((sum, row) => sum + row[field], 0) / rows.length
            : 0
    const change = previous.length ? average(recent) - average(previous) : null
    const Trend =
        change === null ? Minus : change >= 0 ? ArrowUpRight : ArrowDownRight
    const copy = dictionary.clan
    const isKdComparison = kind === "kd" || kind === "combat"
    const roundedChange =
        change === null
            ? ""
            : `${change >= 0 ? "+" : ""}${isKdComparison ? change.toFixed(2) : Math.round(change)}`
    const metricName = kind === "points" ? copy.points : copy.kd
    const comparisonMetric =
        kind === "points"
            ? copy.points
            : kind === "kd" || kind === "combat"
              ? copy.kd
              : copy.combatEffectiveness
    const playerTrendFields: Array<["kd" | "offense" | "support", string]> = [
        ["kd", copy.kd],
        ["offense", copy.combatEffectiveness],
        ["support", copy.supportEffectiveness],
    ]

    return (
        <Card className="border-border/60 overflow-hidden rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                    <CardTitle>{title}</CardTitle>
                    <p className="text-muted-foreground mt-1 text-sm">
                        {copy.performanceLastMatches.replace(
                            "{count}",
                            String(matches.length)
                        )}
                    </p>
                </div>
                {kind === "playerEffectiveness" && previous.length ? (
                    <div className="flex flex-wrap justify-end gap-3">
                        {playerTrendFields.map(([key, label]) => {
                            const rawDelta =
                                (recent.length
                                    ? recent.reduce(
                                          (sum, row) => sum + row[key],
                                          0
                                      ) / recent.length
                                    : 0) -
                                previous.reduce(
                                    (sum, row) => sum + row[key],
                                    0
                                ) /
                                    previous.length
                            const delta =
                                key === "kd"
                                    ? Number(rawDelta.toFixed(2))
                                    : Math.round(rawDelta)
                            const formattedDelta =
                                key === "kd"
                                    ? `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}`
                                    : `${delta >= 0 ? "+" : ""}${delta}`
                            const Icon =
                                delta >= 0 ? ArrowUpRight : ArrowDownRight
                            return (
                                <span
                                    key={key}
                                    className={
                                        delta >= 0
                                            ? "flex items-center text-xs font-medium text-emerald-600"
                                            : "flex items-center text-xs font-medium text-rose-600"
                                    }
                                >
                                    <Icon className="size-3.5" />
                                    {label} {formattedDelta}
                                </span>
                            )
                        })}
                    </div>
                ) : change !== null ? (
                    <span
                        className={
                            change >= 0
                                ? "flex items-center text-sm font-medium text-emerald-600"
                                : "flex items-center text-sm font-medium text-rose-600"
                        }
                    >
                        <Trend className="size-4" />
                        {copy.performanceComparedWithPrevious
                            .replace("{change}", roundedChange)
                            .replace("{metric}", comparisonMetric)
                            .replace("{count}", String(previous.length))}
                    </span>
                ) : null}
            </CardHeader>
            <CardContent>
                {data.length ? (
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data}>
                                <CartesianGrid
                                    vertical={false}
                                    strokeDasharray="3 3"
                                />
                                <XAxis
                                    dataKey="match"
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    allowDecimals={isKdComparison}
                                    tickFormatter={
                                        isKdComparison
                                            ? (val: number) => val.toFixed(2)
                                            : undefined
                                    }
                                    tickLine={false}
                                    axisLine={false}
                                    width={38}
                                />
                                <Tooltip
                                    content={(props) => (
                                        <PerformanceTooltip
                                            {...props}
                                            matches={data}
                                            fallbackLabel={copy.matchesPlayed}
                                        />
                                    )}
                                />
                                <Legend />
                                {kind === "effectiveness" ? (
                                    <>
                                        <Line
                                            type="monotone"
                                            dataKey="combat"
                                            name={copy.combatEffectiveness}
                                            stroke="#f59e0b"
                                            strokeWidth={2.5}
                                            dot={false}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="support"
                                            name={copy.supportEffectiveness}
                                            stroke="#8b5cf6"
                                            strokeWidth={2.5}
                                            dot={false}
                                        />
                                    </>
                                ) : kind === "playerEffectiveness" ? (
                                    <>
                                        <Line
                                            type="monotone"
                                            dataKey="offense"
                                            name={copy.combatEffectiveness}
                                            stroke="#10b981"
                                            strokeWidth={2.5}
                                            dot={false}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="support"
                                            name={copy.supportEffectiveness}
                                            stroke="#8b5cf6"
                                            strokeWidth={2.5}
                                            dot={false}
                                        />
                                    </>
                                ) : kind === "combat" ? (
                                    <>
                                        <Line
                                            type="monotone"
                                            dataKey="kills"
                                            name={copy.kills}
                                            stroke="#10b981"
                                            strokeWidth={2.5}
                                            dot={false}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="deaths"
                                            name={copy.deaths}
                                            stroke="#f43f5e"
                                            strokeWidth={2.5}
                                            dot={false}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="kd"
                                            name={copy.kd}
                                            stroke="#f59e0b"
                                            strokeWidth={2.5}
                                            dot={false}
                                        />
                                    </>
                                ) : (
                                    <Line
                                        type="monotone"
                                        dataKey={field}
                                        name={metricName}
                                        stroke={
                                            kind === "points"
                                                ? "#38bdf8"
                                                : "#f59e0b"
                                        }
                                        strokeWidth={3}
                                        dot={{ r: 3 }}
                                    />
                                )}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <p className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
                        {copy.performanceNoData}
                    </p>
                )}
            </CardContent>
        </Card>
    )
}
