import { CircleCheck, TriangleAlert, UserPlus } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import Link from "next/link"

import type { Dictionary } from "@/i18n/dictionaries"
import { cn } from "@/lib/utils"

export type WaitingItem = {
    key: string
    href: string
    title: string
    detail?: string
    tone: "warning" | "neutral"
}

const icons: Record<WaitingItem["tone"], LucideIcon> = {
    warning: TriangleAlert,
    neutral: UserPlus,
}

/** Manager to-dos on the overview, then the clan's setup progress. */
export function WaitingCard({
    items,
    setup,
    dictionary,
}: {
    items: WaitingItem[]
    setup: { label: string; href: string }
    dictionary: Dictionary
}) {
    const text = dictionary.clanOverview
    return (
        <section
            aria-labelledby="overview-waiting"
            className="bg-card flex min-w-0 flex-[1_1_300px] flex-col gap-3 rounded-2xl border p-5 sm:p-6"
        >
            <h2
                id="overview-waiting"
                className="text-muted-foreground text-xs font-semibold tracking-wide uppercase"
            >
                {text.waitingTitle}
            </h2>
            {items.length ? (
                <ul className="flex flex-col gap-3">
                    {items.map((item) => {
                        const Icon = icons[item.tone]
                        return (
                            <li key={item.key}>
                                <Link
                                    href={item.href}
                                    className="group focus-visible:ring-ring/50 flex items-start gap-2.5 rounded-lg outline-none focus-visible:ring-[3px]"
                                >
                                    <Icon
                                        aria-hidden="true"
                                        className={cn(
                                            "mt-0.5 size-4.5 shrink-0",
                                            item.tone === "warning"
                                                ? "text-amber-600 dark:text-amber-400"
                                                : "text-muted-foreground"
                                        )}
                                    />
                                    <span className="flex min-w-0 flex-col leading-5">
                                        <span className="text-sm font-medium break-words group-hover:underline">
                                            {item.title}
                                        </span>
                                        {item.detail ? (
                                            <span className="text-muted-foreground text-[13px]">
                                                {item.detail}
                                            </span>
                                        ) : null}
                                    </span>
                                </Link>
                            </li>
                        )
                    })}
                </ul>
            ) : (
                <p className="text-muted-foreground flex items-center gap-2 text-sm">
                    <CircleCheck
                        aria-hidden="true"
                        className="size-4 text-emerald-600 dark:text-emerald-400"
                    />
                    {text.nothingWaiting}
                </p>
            )}
            <Link
                href={setup.href}
                className="mt-auto pt-1 text-[13px] font-medium underline underline-offset-3"
            >
                {setup.label}
            </Link>
        </section>
    )
}
