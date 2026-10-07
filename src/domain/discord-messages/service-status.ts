/**
 * "Stav služeb Logi" (board L5 1.2): one message in the channel the Logi
 * global administration picks, edited in place after every check, plus a
 * short card in the thread "Změny stavu" for each change of a service. In
 * the clan language of the Logi workspace, with the neutral grey bar of
 * system messages; each service's state is a chip. Game servers are not
 * part of it (L5-B07): the monitor only reads the Logi services group.
 */

import {
    discordTimestamp,
    fillTemplate,
    formatCount,
    type PluralForms,
} from "./format"
import type { MessageView } from "./message-view"
import { joinWithAnd } from "./bot-errors"

/** How often the bot checks the services (L5-34, L5-B06). */
export const SERVICE_STATUS_INTERVAL_SECONDS = 30

/** One service as the bot stores it between checks. */
export type ServiceState = {
    name: string
    online: boolean
    /** When the service last changed state (ISO); the outage start when offline. */
    since?: string
}

/** A change of one service between two checks. */
export type ServiceChange = {
    name: string
    online: boolean
    /** When the outage started; for a recovery, from the stored state. */
    startedAt?: string
    /** When the outage ended (a recovery only). */
    endedAt?: string
}

export type ServiceStatusCopy = {
    /** "Služby Logi". */
    label: string
    /** "Všechno běží". */
    allRunning: string
    /** "{service} nefunguje". */
    oneDown: string
    /** "{services} nefungují". */
    manyDown: string
    /** "Stav teď neznáme". */
    unknownTitle: string
    /** "Monitoring neodpovídá". */
    unknownChip: string
    unknownBody: string
    /** "Kontrola každých {seconds} s · naposledy dnes v {time}". */
    checked: string
    /** "V provozu". */
    up: string
    /** "Nedostupné". */
    down: string
    /** "Změny stavu jsou ve vlákně". */
    threadNote: string
    /** "Změny stavu". */
    threadName: string
    /** "{service} nefunguje". */
    changeDownTitle: string
    /** "Výpadek začal v {time}." */
    changeDownBody: string
    /** "{service} zase běží". */
    changeUpTitle: string
    /** "Výpadek trval {duration}." */
    changeUpBody: string
    /** A recovery whose start Logi does not know. */
    changeUpBodyUnknown: string
    duration: {
        lessThanMinute: string
        minutes: PluralForms
        hours: PluralForms
        days: PluralForms
        /** Joins two units: "{first} a {second}". */
        pair: string
    }
    /** "a": joins the last two service names. */
    and: string
}

/**
 * The stored states after a check and the changes to post. A service seen
 * for the first time is no change; a recovery carries the outage start so
 * the thread can say how long it lasted. Services the monitor no longer
 * lists are dropped.
 */
export function nextServiceStates(
    previous: readonly ServiceState[] | null | undefined,
    current: ReadonlyArray<{ name: string; online: boolean }>,
    now: string
): { states: ServiceState[]; changes: ServiceChange[] } {
    const known = new Map((previous ?? []).map((item) => [item.name, item]))
    const states: ServiceState[] = []
    const changes: ServiceChange[] = []
    for (const service of current) {
        const before = known.get(service.name)
        if (!before) {
            states.push({ ...service, since: now })
            continue
        }
        if (before.online === service.online) {
            states.push({ ...service, since: before.since ?? now })
            continue
        }
        changes.push(
            service.online
                ? {
                      name: service.name,
                      online: true,
                      ...(before.since ? { startedAt: before.since } : {}),
                      endedAt: now,
                  }
                : { name: service.name, online: false, startedAt: now }
        )
        states.push({ ...service, since: now })
    }
    return { states, changes }
}

/**
 * Whether two stored service lists say the same, entry by entry (name,
 * state and since). The bot saves its state, and Logi stores it, only when
 * they differ: an unchanged check every 30 s writes nothing.
 */
export function sameServiceStates(
    left: readonly ServiceState[] | null | undefined,
    right: readonly ServiceState[] | null | undefined
): boolean {
    const a = left ?? [],
        b = right ?? []
    return (
        a.length === b.length &&
        a.every(
            (state, index) =>
                state.name === b[index]!.name &&
                state.online === b[index]!.online &&
                (state.since ?? null) === (b[index]!.since ?? null)
        )
    )
}

/** "7 minut", "2 hodiny a 5 minut", "méně než minutu". */
export function formatOutageDuration(
    copy: ServiceStatusCopy,
    locale: string,
    milliseconds: number
) {
    const minutes = Math.round(Math.max(0, milliseconds) / 60_000)
    const d = copy.duration
    if (minutes < 1) return d.lessThanMinute
    if (minutes < 60) return formatCount(locale, minutes, d.minutes)
    const pair = (first: string, second: string | undefined) =>
        second ? fillTemplate(d.pair, { first, second }) : first
    if (minutes < 24 * 60) {
        const rest = minutes % 60
        return pair(
            formatCount(locale, Math.floor(minutes / 60), d.hours),
            rest ? formatCount(locale, rest, d.minutes) : undefined
        )
    }
    const hours = Math.floor(minutes / 60)
    const rest = hours % 24
    return pair(
        formatCount(locale, Math.floor(hours / 24), d.days),
        rest ? formatCount(locale, rest, d.hours) : undefined
    )
}

/**
 * The status message (L5-34..36): "SLUŽBY LOGI", "Všechno běží" or which
 * service is down, the check line and one row per service with its chip.
 * `services` null means the monitor did not answer: "Stav teď neznáme".
 */
export function serviceStatusView(input: {
    copy: ServiceStatusCopy
    locale: string
    services: ReadonlyArray<{ name: string; online: boolean }> | null
    checkedAt: number | string
}): MessageView {
    const { copy } = input
    const footer = {
        kind: "managed" as const,
        notes: [copy.threadNote],
    }
    if (!input.services)
        return {
            accent: "system",
            header: {
                label: copy.label,
                title: copy.unknownTitle,
                chips: [{ label: copy.unknownChip, tone: "neutral" }],
            },
            blocks: [{ kind: "text", markdown: copy.unknownBody }],
            footer,
        }
    const down = input.services
        .filter((service) => !service.online)
        .map((service) => service.name)
    const title = !down.length
        ? copy.allRunning
        : down.length === 1
          ? fillTemplate(copy.oneDown, { service: down[0]! })
          : fillTemplate(copy.manyDown, {
                services: joinWithAnd(down, copy.and),
            })
    const time = discordTimestamp(input.checkedAt, "t")
    return {
        accent: "system",
        header: { label: copy.label, title },
        blocks: [
            ...(time
                ? [
                      {
                          kind: "meta" as const,
                          lines: [
                              {
                                  text: fillTemplate(copy.checked, {
                                      seconds: String(
                                          SERVICE_STATUS_INTERVAL_SECONDS
                                      ),
                                      time,
                                  }),
                              },
                          ],
                      },
                  ]
                : []),
            ...(input.services.length
                ? [
                      {
                          kind: "fields" as const,
                          items: input.services.map((service) => ({
                              title: service.name,
                              chip: service.online
                                  ? { label: copy.up, tone: "success" as const }
                                  : {
                                        label: copy.down,
                                        tone: "danger" as const,
                                    },
                          })),
                      },
                  ]
                : []),
        ],
        footer,
    }
}

/**
 * One card in the thread "Změny stavu" (L5-37): "Discord bot nefunguje" /
 * "Výpadek začal v 14:02." or "Discord bot zase běží" / "Výpadek trval 7
 * minut." Grey, without a footer.
 */
export function serviceChangeView(input: {
    copy: ServiceStatusCopy
    locale: string
    change: ServiceChange
}): MessageView {
    const { copy, change } = input
    if (!change.online) {
        const time = discordTimestamp(change.startedAt, "t")
        return {
            accent: "system",
            header: {
                title: fillTemplate(copy.changeDownTitle, {
                    service: change.name,
                }),
            },
            blocks: time
                ? [
                      {
                          kind: "text",
                          markdown: fillTemplate(copy.changeDownBody, { time }),
                      },
                  ]
                : [],
        }
    }
    const start = change.startedAt ? Date.parse(change.startedAt) : Number.NaN
    const end = change.endedAt ? Date.parse(change.endedAt) : Number.NaN
    const body =
        Number.isFinite(start) && Number.isFinite(end) && end >= start
            ? fillTemplate(copy.changeUpBody, {
                  duration: formatOutageDuration(
                      copy,
                      input.locale,
                      end - start
                  ),
              })
            : copy.changeUpBodyUnknown
    return {
        accent: "system",
        header: {
            title: fillTemplate(copy.changeUpTitle, { service: change.name }),
        },
        blocks: [{ kind: "text", markdown: body }],
    }
}
