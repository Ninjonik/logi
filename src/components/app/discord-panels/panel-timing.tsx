import { ExternalLink } from "lucide-react"

import type { PanelTimingPart } from "@/domain/discord-publications/panel-list"
import type { Dictionary } from "@/i18n/dictionaries"

import { dayTime, timeAgo, timeIn } from "./panel-time"
import { fill, plural } from "./panel-copy"
import { MetaLine } from "./panel-chips"

/** One timing part in words ("Aktualizováno před 12 s", P1-B02). */
export function timingText(
    part: Exclude<PanelTimingPart, { kind: "open" }>,
    input: { now: number; locale: string; dictionary: Dictionary }
) {
    const text = input.dictionary.discordPanelsPage
    const t = text.list.timing
    const ago = (at: number) => timeAgo(at, input.now, input.locale)
    const inTime = (at: number) =>
        timeIn(at, input.now, input.locale, text.time)
    const when = (at: number) => dayTime(at, input.now, input.locale, text.time)
    switch (part.kind) {
        case "updated":
            return fill(t.updated, { ago: ago(part.at) })
        case "nextRefresh":
            return fill(t.nextRefresh, { in: inTime(part.at) })
        case "lastAttempt":
            return fill(t.lastAttempt, { ago: ago(part.at) })
        case "nextRetry":
            return fill(t.nextRetry, { in: inTime(part.at) })
        case "notInDiscord":
            return t.notInDiscord
        case "requested":
            return fill(t.requested, { ago: ago(part.at) })
        case "pickup":
            return t.pickup
        case "firstPass":
            return t.firstPass
        case "saved":
            return fill(t.saved, { when: when(part.at) })
        case "notSentYet":
            return t.notSentYet
        case "pausedBy":
            return part.by && part.at !== null
                ? fill(t.pausedBy, { name: part.by, when: when(part.at) })
                : part.at !== null
                  ? fill(t.pausedAt, { when: when(part.at) })
                  : null
        case "pausedKeeps":
            return t.pausedKeeps
        case "lastResult":
            return fill(t.lastResult, { when: when(part.at) })
        case "noResultYet":
            return t.noResultYet
        case "resultsInChannel":
            return plural(t.resultsInChannel, part.count, input.locale)
        case "resultsBackfill":
            return t.resultsBackfill
        case "controlButtons":
            return t.controlButtons
    }
}

/** The timing line of a row with "Otevřít zprávu ↗" where the message exists. */
export function PanelTimingLine({
    parts,
    messageUrl,
    now,
    locale,
    dictionary,
}: {
    parts: readonly PanelTimingPart[]
    messageUrl: string | null
    now: number
    locale: string
    dictionary: Dictionary
}) {
    const items = parts.map((part) =>
        part.kind === "open" ? (
            messageUrl ? (
                <a
                    href={messageUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-foreground inline-flex items-center gap-1 underline underline-offset-3"
                >
                    {dictionary.discordPanelsPage.list.timing.open}
                    <ExternalLink className="size-3" aria-hidden="true" />
                </a>
            ) : null
        ) : (
            timingText(part, { now, locale, dictionary })
        )
    )
    return <MetaLine items={items} className="text-xs sm:text-[13px]" />
}
