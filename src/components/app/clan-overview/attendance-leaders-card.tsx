import type { AttendanceLeader } from "@/lib/read-models/clan-overview"
import { fill } from "@/components/app/clan-overview/overview-format"
import type { Dictionary } from "@/i18n/dictionaries"

/**
 * "Most attendance points · October" (design G1): the members who earned the
 * most points this month under the clan's score rules.
 */
export function AttendanceLeadersCard({
    month,
    leaders,
    dictionary,
}: {
    /** The month's name, e.g. "říjen". */
    month: string
    leaders: AttendanceLeader[]
    dictionary: Dictionary
}) {
    const text = dictionary.clanOverview
    return (
        <section
            aria-labelledby="overview-points"
            className="bg-card flex min-w-0 flex-[1_1_360px] flex-col gap-3 rounded-2xl border p-5 sm:p-6"
        >
            <h2
                id="overview-points"
                className="text-muted-foreground text-xs font-semibold tracking-wide uppercase"
            >
                {fill(text.pointsTitle, { month })}
            </h2>
            {leaders.length ? (
                <ol className="flex flex-col gap-1.5">
                    {leaders.map((leader, index) => (
                        <li
                            key={leader.userId}
                            className="flex items-baseline gap-3 text-sm"
                        >
                            <span className="text-muted-foreground w-4 shrink-0 tabular-nums">
                                {index + 1}
                            </span>
                            <span className="min-w-0 flex-1 truncate">
                                {leader.name ?? text.pointsUnknownMember}
                            </span>
                            <span className="font-semibold tabular-nums">
                                {leader.points}
                            </span>
                        </li>
                    ))}
                </ol>
            ) : (
                <p className="text-muted-foreground text-sm">
                    {text.pointsEmpty}
                </p>
            )}
        </section>
    )
}
