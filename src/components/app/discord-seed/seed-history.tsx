import type { SeedDashboardView } from "@/application/discord-seed/read-dashboard"
import { formatSeedDuration } from "@/domain/discord-seed/views"
import type { Dictionary } from "@/i18n/dictionaries"
import { pluralize } from "@/i18n/plural"

import { fillSeedText, seedHistoryRow } from "./seed-page-state"
import { SeedChip } from "./seed-chip"

/**
 * "Historie seedů" (P3-26..32): the last 30 days of one server, newest
 * first, with who started each seed, the counts, the result, the duration and
 * whom the call pinged. Older seeds stay stored.
 */
export function SeedHistory({
    serverName,
    history,
    locale,
    timeZone,
    text,
    channelName,
    roleName,
}: {
    serverName: string
    history: SeedDashboardView["history"]
    locale: string
    timeZone: string
    text: Dictionary["seedPage"]
    channelName(id: string): string | null
    roleName(id: string): string | null
}) {
    const t = text.history
    const { summary } = history
    const seeds = pluralize(locale, summary.count, t.seeds)
    const summaryText =
        summary.averageMinutesToLive === null
            ? fillSeedText(t.summaryNoLive, {
                  days: summary.days,
                  count: seeds,
              })
            : fillSeedText(t.summary, {
                  days: summary.days,
                  count: seeds,
                  average: formatSeedDuration(
                      summary.averageMinutesToLive,
                      t.units
                  ),
              })
    const rows = history.entries.map((entry) =>
        seedHistoryRow(entry, {
            timeZone,
            locale,
            weekdays: text.plan.weekdays,
            text: t,
            channelName,
            roleName,
        })
    )
    const headingId = "seed-history-title"
    return (
        <section
            aria-labelledby={headingId}
            className="bg-card space-y-3 rounded-2xl border p-4 sm:p-5"
        >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 id={headingId} className="text-base font-semibold">
                    {fillSeedText(t.title, { server: serverName })}
                </h2>
                <p className="text-muted-foreground text-[13px]">
                    {summaryText}
                </p>
            </div>
            {rows.length ? (
                <div className="-mx-4 overflow-x-auto sm:mx-0">
                    <table className="w-full min-w-[40rem] border-collapse text-left text-[13px]">
                        <thead>
                            <tr className="text-muted-foreground border-b text-xs">
                                <th
                                    scope="col"
                                    className="px-4 py-2 font-medium sm:pl-0"
                                >
                                    {t.columns.start}
                                </th>
                                <th
                                    scope="col"
                                    className="px-2 py-2 font-medium"
                                >
                                    {t.columns.trigger}
                                </th>
                                <th
                                    scope="col"
                                    className="px-2 py-2 font-medium"
                                >
                                    {t.columns.players}
                                </th>
                                <th
                                    scope="col"
                                    className="px-2 py-2 font-medium"
                                >
                                    {t.columns.result}
                                </th>
                                <th
                                    scope="col"
                                    className="px-2 py-2 font-medium"
                                >
                                    {t.columns.duration}
                                </th>
                                <th
                                    scope="col"
                                    className="px-4 py-2 font-medium sm:pr-0"
                                >
                                    {t.columns.pinged}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr
                                    key={row.id}
                                    className="border-b align-top last:border-0"
                                >
                                    <td className="px-4 py-2.5 whitespace-nowrap sm:pl-0">
                                        {row.start}
                                    </td>
                                    <td className="px-2 py-2.5">
                                        {row.startedBy}
                                    </td>
                                    <td className="px-2 py-2.5 whitespace-nowrap tabular-nums">
                                        {row.players}
                                    </td>
                                    <td className="px-2 py-2.5">
                                        <SeedChip tone={row.outcome.tone}>
                                            {row.outcome.label}
                                        </SeedChip>
                                    </td>
                                    <td className="px-2 py-2.5">
                                        {row.duration}
                                    </td>
                                    <td className="px-4 py-2.5 sm:pr-0">
                                        {row.pinged}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="text-muted-foreground text-sm">{t.empty}</p>
            )}
        </section>
    )
}
