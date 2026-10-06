import { Bot } from "lucide-react"

import type { Dictionary } from "@/i18n/dictionaries"
import { cn } from "@/lib/utils"

import type { PanelOverviewResponse } from "./panels-api"
import { timeAgo } from "./panel-time"
import { fill } from "./panel-copy"

/**
 * "Stav bota" (P1-04..06, P1-B05): the bot heartbeat with its version and
 * last contact, and in the same place the warning when the bot is silent or
 * runs an older panel protocol, naming its version and the release the
 * panels need (`MINIMUM_BOT_VERSION`).
 */
export function BotStatusStrip({
    bot,
    botInServer,
    now,
    locale,
    dictionary,
}: {
    bot: PanelOverviewResponse["bot"]
    botInServer: boolean | null
    now: number
    locale: string
    dictionary: Dictionary
}) {
    const text = dictionary.discordPanelsPage.bot
    if (bot.state === "online")
        return (
            <div className="space-y-2">
                <div
                    role="status"
                    className="flex flex-col gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] text-emerald-900 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                >
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span
                            aria-hidden="true"
                            className="size-2 rounded-full bg-emerald-500"
                        />
                        <Bot className="size-4" aria-hidden="true" />
                        <span className="font-semibold">{text.online}</span>
                        <span className="text-emerald-800/90 dark:text-emerald-300/90">
                            {fill(text.version, {
                                version: bot.version,
                                ago: timeAgo(bot.seenAt, now, locale),
                            })}
                        </span>
                    </div>
                    <span className="text-emerald-800/90 sm:text-right dark:text-emerald-300/90">
                        {text.refreshEvery}
                    </span>
                </div>
                {botInServer === false ? (
                    <Warning tone="amber" title={text.notInServer} />
                ) : null}
            </div>
        )
    if (bot.state === "offline")
        return (
            <Warning
                tone="red"
                title={fill(text.offlineTitle, {
                    ago: timeAgo(bot.seenAt, now, locale),
                })}
                body={text.offlineBody}
            />
        )
    if (bot.state === "outdated")
        return (
            <Warning
                tone="amber"
                title={fill(text.outdatedTitle, { version: bot.version })}
                body={fill(text.outdatedBody, {
                    required: bot.requiredVersion,
                })}
            />
        )
    return (
        <Warning
            tone="amber"
            title={text.unknownTitle}
            body={text.unknownBody}
        />
    )
}

function Warning({
    tone,
    title,
    body,
}: {
    tone: "red" | "amber"
    title: string
    body?: string
}) {
    return (
        <div
            role="alert"
            className={cn(
                "flex items-start gap-2.5 rounded-xl border px-4 py-2.5 text-[13px]",
                tone === "red"
                    ? "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
                    : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
            )}
        >
            <Bot className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>
                <span className="font-semibold">{title}</span>
                {body ? <> {body}</> : null}
            </p>
        </div>
    )
}
