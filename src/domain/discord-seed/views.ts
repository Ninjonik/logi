import {
    escapeMarkdownText,
    type MessageButton,
    type MessageChip,
    type MessageMedia,
    type MessageView,
} from "../discord-messages/message-view"
import { discordTimestamp } from "../discord-messages/format"
import type { SeedServerStatus } from "./thresholds"
import type { SeedMessagesCopy } from "./seed-copy"
import type { SeedHistoryTrigger } from "./history"
import { renderSeedTemplate } from "./template"
import type { SeedPlanSettings } from "./plan"
import { weekdayRanges } from "./schedule"
import { seedProgress } from "./progress"
import { seedRunSeeders } from "./run"
import { parseClock } from "./clock"
import type { SeedRun } from "./run"

/**
 * The seed messages as framework-free views (board P5), shared by the bot,
 * which posts them, and the dashboard, which previews them (P3-19, P3-20).
 * The words come from {@link SeedMessagesCopy} in the clan language.
 */

export type SeedGame = "hell_let_loose" | "wardogs"

/** The refresh of the call and the panels (P3-21, P5-10). */
export const SEED_CALL_REFRESH_SECONDS = 60

const number = (value: number, locale: string) =>
    new Intl.NumberFormat(locale).format(value)

/** "45 min", "2 h", "1 h 05 min" (P3-28..32, P5-13). */
export function formatSeedDuration(
    minutes: number,
    units: SeedMessagesCopy["units"]
): string {
    const total = Math.max(0, Math.round(minutes))
    const hours = Math.floor(total / 60)
    const rest = total % 60
    if (!hours) return `${rest} ${units.minutes}`
    if (!rest) return `${hours} ${units.hours}`
    return `${hours} ${units.hours} ${String(rest).padStart(2, "0")} ${units.minutes}`
}

/** "Po–Pá 17:00", "So, Ne 10:00" for a schedule slot (P3-19, P3-28). */
export function seedSlotLabel(
    slot: { days: readonly number[]; time: string },
    weekdays: readonly string[]
): string {
    const days = weekdayRanges([...slot.days])
        .map((range) =>
            range.from === range.to
                ? weekdays[range.from]
                : `${weekdays[range.from]}–${weekdays[range.to]}`
        )
        .join(", ")
    return `${days} ${slot.time}`
}

/** Who started a seed, for the call and the history ("seed spustil Kowalski"). */
export function seedStarterText(
    trigger: SeedHistoryTrigger | SeedRun["trigger"],
    copy: SeedMessagesCopy
): string {
    if (trigger.kind === "manual")
        return copy.call.startedBy.manual(
            escapeMarkdownText(
                "actorName" in trigger ? trigger.actorName : trigger.actor.name
            )
        )
    if (trigger.kind === "schedule")
        return copy.call.startedBy.schedule(
            seedSlotLabel(trigger, copy.weekdays)
        )
    return copy.call.startedBy.auto
}

export type SeedCallInput = {
    run: Pick<
        SeedRun,
        | "status"
        | "trigger"
        | "startedAt"
        | "endedAt"
        | "liveFrom"
        | "players"
        | "ping"
        | "endedBy"
    >
    server: { name: string; gameId: SeedGame }
    /** "Foy · Warfare · Den", already escaped; null without map data. */
    mapLine: string | null
    /** The plan's own text; null uses the clan-language default. */
    template: string | null
    /** "Zvát mě na seed" while seeding, when players toggle the role themselves. */
    roleButton: { roleId: string } | null
    /** "Připojit se" opens `/join/<server>`. */
    joinUrl: string | null
    /** The map picture on the right. */
    thumbnail: MessageMedia | null
    updatedAt: number
    timeZone: string
    locale: string
    copy: SeedMessagesCopy
}

const chip = (label: string, tone: MessageChip["tone"]): MessageChip => ({
    label,
    tone,
})

/** The button of the opt-in role: `seed:role:<roleId>`. */
export function seedRoleButtonId(roleId: string) {
    return `seed:role:${roleId}`
}

/**
 * The line above the card that pings the Seed role. It is there while the
 * seed runs and the run may ping; the bot pings only when it posts, so edits
 * ping nobody, and the line goes when the server is live (P5-03, P5-14).
 */
export function seedCallLead(
    run: Pick<SeedRun, "status" | "ping">
): { roleId: string; markdown: string } | null {
    return run.status === "seeding" && run.ping.kind === "role"
        ? { roleId: run.ping.roleId, markdown: `<@&${run.ping.roleId}>` }
        : null
}

/** The call in the seed channel: seeding, live or ended (P5-06..14). */
export function seedCallView(input: SeedCallInput): MessageView {
    const { run, copy, locale } = input
    const label = `${copy.labels.seed} · ${copy.game[input.server.gameId]}`
    const players = run.players.end ?? run.players.latest
    const playersText = players === null ? "?" : number(players, locale)
    const capacity =
        run.players.capacity === null
            ? null
            : number(run.players.capacity, locale)
    const join: MessageButton[] = input.joinUrl
        ? [{ kind: "link", url: input.joinUrl, label: copy.call.buttons.join }]
        : []
    const durationMinutes =
        ((run.endedAt ?? input.updatedAt) - run.startedAt) / 60_000
    const duration = formatSeedDuration(durationMinutes, copy.units)
    const mapLine = input.mapLine?.trim() || null
    const server = escapeMarkdownText(input.server.name)

    if (run.status === "seeding") {
        const progress = seedProgress(run.players.latest, run.liveFrom)
        const progressLine = `${progress.bar} **${progress.players === null ? "?" : number(progress.players, locale)} / ${number(run.liveFrom, locale)}**`
        const liveFrom = number(run.liveFrom, locale)
        const text = input.template
            ? renderSeedTemplate(input.template, {
                  server: input.server.name,
                  players: progress.players,
                  missing: progress.missing,
                  threshold: run.liveFrom,
              })
            : progress.stage === "close" && progress.missing !== null
              ? copy.call.closeText(progress.missing)
              : copy.call.startingText(liveFrom)
        const progressBlock =
            input.template && progress.missing !== null
                ? `${progressLine}\n${copy.call.missingLine(progress.missing)}`
                : progressLine
        const meta = [mapLine, seedStarterText(run.trigger, copy)]
            .filter(Boolean)
            .join(" · ")
        const buttons: MessageButton[] = [
            ...join,
            ...(input.roleButton
                ? [
                      {
                          kind: "action" as const,
                          id: seedRoleButtonId(input.roleButton.roleId),
                          label: copy.call.buttons.role,
                          style: "secondary" as const,
                      },
                  ]
                : []),
        ]
        return {
            accent: "clan",
            header: {
                label,
                title: copy.call.title(input.server.name),
                chips: [chip(copy.chips.seeding, "warning")],
                status: copy.call.status(playersText, capacity, liveFrom),
                ...(input.thumbnail ? { thumbnail: input.thumbnail } : {}),
            },
            blocks: [
                { kind: "text", markdown: progressBlock },
                { kind: "text", markdown: text },
                { kind: "meta", lines: [{ text: meta }] },
                ...(buttons.length
                    ? [
                          {
                              kind: "separator" as const,
                              divider: true,
                              spacing: "small" as const,
                          },
                          { kind: "buttons" as const, buttons },
                      ]
                    : []),
            ],
            footer: {
                kind: "managed",
                updatedAt: input.updatedAt,
                refreshSeconds: SEED_CALL_REFRESH_SECONDS,
            },
        }
    }

    const ending = run.status === "live"
    const endedAt = run.endedAt ?? input.updatedAt
    const endTime = discordTimestamp(endedAt, "t") ?? ""
    const text = ending
        ? copy.call.liveText(endTime)
        : run.status === "ended_admin"
          ? copy.call.endedText.admin(
                run.endedBy ? escapeMarkdownText(run.endedBy.name) : null
            )
          : run.status === "ended_timeout"
            ? copy.call.endedText.timeout(
                  number(run.liveFrom, locale),
                  duration
              )
            : copy.call.endedText.failed
    const meta = ending
        ? [server, mapLine].filter(Boolean).join(" · ")
        : mapLine
    return {
        accent: "clan",
        header: {
            label,
            title: ending
                ? copy.call.liveTitle
                : copy.call.endedTitle(input.server.name),
            chips: [
                ending
                    ? chip(copy.chips.live, "success")
                    : chip(copy.chips.ended, "neutral"),
            ],
            status: ending
                ? copy.call.liveStatus(
                      playersText,
                      capacity,
                      seedRunSeeders(run)
                  )
                : copy.call.status(
                      playersText,
                      capacity,
                      number(run.liveFrom, locale)
                  ),
            ...(input.thumbnail ? { thumbnail: input.thumbnail } : {}),
        },
        blocks: [
            { kind: "text", markdown: text },
            ...(meta
                ? [{ kind: "meta" as const, lines: [{ text: meta }] }]
                : []),
            ...(join.length
                ? [
                      {
                          kind: "separator" as const,
                          divider: true,
                          spacing: "small" as const,
                      },
                      { kind: "buttons" as const, buttons: join },
                  ]
                : []),
        ],
        footer: { kind: "managed", notes: [copy.call.duration(duration)] },
    }
}

export type SeedIntroInput = {
    clanName: string
    /** The servers seeded from this channel and their schedules. */
    servers: Array<{
        name: string
        schedule: SeedPlanSettings["schedule"]
    }>
    roleId: string
    copy: SeedMessagesCopy
}

/**
 * When a channel's seeds usually happen: the scheduled weekdays and the part
 * of the day of the earliest slot, or null without a schedule.
 */
export function seedUsualTime(
    schedules: ReadonlyArray<SeedPlanSettings["schedule"]>,
    copy: SeedMessagesCopy
): string | null {
    const slots = schedules
        .filter((schedule) => schedule.enabled)
        .flatMap((schedule) => schedule.slots)
    if (!slots.length) return null
    const days = [...new Set(slots.flatMap((slot) => slot.days))]
    const minutes = Math.min(...slots.map((slot) => parseClock(slot.time) ?? 0))
    return `${copy.intro.days(days)} ${copy.intro.partOfDay(minutes)}`
}

/** The pinned intro of the seed channel with the role toggle (P5-20, P5-21). */
export function seedIntroView(input: SeedIntroInput): MessageView {
    const { copy } = input
    const names = input.servers.map((server) => escapeMarkdownText(server.name))
    const when = seedUsualTime(
        input.servers.map((server) => server.schedule),
        copy
    )
    return {
        accent: "clan",
        header: { title: copy.intro.title(input.clanName) },
        blocks: [
            { kind: "text", markdown: copy.intro.body },
            ...(names.length
                ? [
                      {
                          kind: "meta" as const,
                          lines: [
                              {
                                  text: copy.intro.usually(
                                      copy.intro.list(names),
                                      when
                                  ),
                              },
                          ],
                      },
                  ]
                : []),
            {
                kind: "buttons",
                buttons: [
                    {
                        kind: "action",
                        id: seedRoleButtonId(input.roleId),
                        label: copy.intro.button,
                        style: "primary",
                    },
                ],
            },
        ],
        footer: { kind: "managed" },
    }
}

export type SeedControlAction =
    "start" | "stop" | "refresh" | "pause" | "resume"

/** `seed:<action>:<connectionId>` on the control message. */
export function seedControlButtonId(
    action: SeedControlAction,
    connectionId: string
) {
    return `seed:${action}:${connectionId}`
}

export type SeedControlInput = {
    connectionId: string
    server: { name: string; gameId: SeedGame }
    status: SeedServerStatus
    seeding: boolean
    players: number | null
    capacity: number | null
    mapName: string | null
    liveFrom: number
    /** The server's live panel; null when it has none. */
    panel: { paused: boolean } | null
    locale: string
    copy: SeedMessagesCopy
}

/**
 * One "Ovládání serveru" message per server in the private admin channel
 * (P5-26..29): the state chip, the count and one row of buttons. During a
 * seed "Spustit seed" becomes the red "Ukončit seed"; on a live server it is
 * grey, not the primary action.
 */
export function seedControlView(input: SeedControlInput): MessageView {
    const { copy, locale } = input
    const count = (value: number | null) =>
        value === null ? null : number(value, locale)
    const map = input.mapName ? escapeMarkdownText(input.mapName) : null
    const state: MessageChip = input.seeding
        ? chip(copy.chips.seeding, "warning")
        : input.status === "live"
          ? chip(copy.chips.live, "success")
          : input.status === "below_start"
            ? chip(copy.chips.empty, "neutral")
            : input.status === "filling"
              ? chip(copy.chips.filling, "info")
              : input.status === "offline"
                ? chip(copy.chips.offline, "danger")
                : chip(copy.chips.unknown, "neutral")
    const id = (action: SeedControlAction) =>
        seedControlButtonId(action, input.connectionId)
    const seedButton: MessageButton = input.seeding
        ? {
              kind: "action",
              id: id("stop"),
              label: copy.control.buttons.stop,
              style: "danger",
          }
        : {
              kind: "action",
              id: id("start"),
              label: copy.control.buttons.start,
              style: input.status === "live" ? "secondary" : "primary",
          }
    return {
        accent: "clan",
        header: {
            label: `${copy.labels.control} · ${copy.game[input.server.gameId]}`,
            title: input.server.name,
            chips: [state],
            status: input.seeding
                ? copy.control.seedingStatus(
                      count(input.players),
                      count(input.capacity),
                      number(input.liveFrom, locale)
                  )
                : copy.control.status(
                      count(input.players),
                      count(input.capacity),
                      map
                  ),
        },
        blocks: [
            {
                kind: "buttons",
                buttons: [
                    seedButton,
                    {
                        kind: "action",
                        id: id("refresh"),
                        label: copy.control.buttons.refresh,
                        style: "secondary",
                        disabled: !input.panel,
                    },
                    input.panel?.paused
                        ? {
                              kind: "action",
                              id: id("resume"),
                              label: copy.control.buttons.resume,
                              style: "secondary",
                          }
                        : {
                              kind: "action",
                              id: id("pause"),
                              label: copy.control.buttons.pause,
                              style: "secondary",
                              disabled: !input.panel,
                          },
                ],
            },
        ],
        footer: { kind: "managed", notes: [copy.control.footer] },
    }
}

/** "Roli Seed máš zapnutou" / "… vypnutou" (P5-23, P5-24). */
export function seedRoleReplyView(
    state: "on" | "off" | "unavailable",
    copy: SeedMessagesCopy,
    /** Where the calls are, e.g. `<#id>`. */
    seedChannel: string
): MessageView {
    const [title, body] =
        state === "on"
            ? [copy.role.onTitle, copy.role.onBody]
            : state === "off"
              ? [copy.role.offTitle, copy.role.offBody(seedChannel)]
              : [copy.role.unavailableTitle, copy.role.unavailableBody]
    return {
        accent: "clan",
        ephemeral: true,
        header: { title },
        blocks: [{ kind: "text", markdown: body }],
    }
}

/** What a seed or panel button answered, for {@link seedActionReplyView}. */
export type SeedButtonResult =
    | { status: "started"; channelId: string; pinged: boolean }
    | { status: "duplicate" }
    | { status: "stopped" }
    | { status: "running" }
    | { status: "cooldown"; retryAt: string }
    | {
          status: "unavailable"
          reason:
              | "disabled"
              | "not_configured"
              | "offline"
              | "already_live"
              | "not_running"
      }
    | { status: "forbidden" }
    | { status: "not_found" }
    | { status: "panel"; action: "refresh" | "pause" | "resume" }
    | { status: "panel_missing" }
    | { status: "panel_not_sent" }

/** "HH:MM" of an instant in the clan's zone. */
export function seedClockTime(at: number, timeZone: string, locale: string) {
    return new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        timeZone,
    }).format(at)
}

/**
 * The private answer to "Spustit seed", "Ukončit seed", "Obnovit panel",
 * "Pozastavit panel" and "Pokračovat" (P5-30..32): what happened, the next
 * step and at most one link ("Otevřít výzvu", "Naplánovat v Logi").
 */
export function seedActionReplyView(input: {
    result: SeedButtonResult
    server: string
    /** `<#id>` of the server's panel channel, if it has a panel. */
    panelChannel: string | null
    /** Link to the call message once it is in Discord. */
    callUrl: string | null
    /** The P3 page, for "Naplánovat v Logi". */
    planUrl: string | null
    cooldownMinutes: number
    liveFrom: number
    now: number
    timeZone: string
    locale: string
    copy: SeedMessagesCopy
}): MessageView {
    const { copy, result } = input
    const r = copy.replies
    const link = (
        url: string | null,
        label: string
    ): MessageButton | undefined =>
        url ? { kind: "link", url, label } : undefined
    switch (result.status) {
        case "started":
            return seedReplyView({
                title: r.startedTitle(input.server),
                body: r.startedBody(
                    `<#${result.channelId}>`,
                    result.pinged,
                    input.panelChannel
                ),
                action: link(input.callUrl, r.openCall),
            })
        case "duplicate":
        case "running":
            return seedReplyView({
                title: r.runningTitle(input.server),
                body: r.runningBody,
                action: link(input.callUrl, r.openCall),
            })
        case "cooldown": {
            const at = Date.parse(result.retryAt)
            return seedReplyView({
                title: r.cooldownTitle,
                body: r.cooldownBody(
                    formatSeedDuration(
                        Math.ceil((at - input.now) / 60_000),
                        copy.units
                    ),
                    seedClockTime(at, input.timeZone, input.locale),
                    input.cooldownMinutes
                ),
                action: link(input.planUrl, r.schedule),
            })
        }
        case "unavailable":
            switch (result.reason) {
                case "already_live":
                    return seedReplyView({
                        title: r.alreadyLiveTitle,
                        body: r.alreadyLiveBody(String(input.liveFrom)),
                    })
                case "offline":
                    return seedReplyView({
                        title: r.offlineTitle,
                        body: r.offlineBody,
                    })
                case "disabled":
                    return seedReplyView({
                        title: r.disabledTitle,
                        body: r.disabledBody,
                        action: link(input.planUrl, r.openInLogi),
                    })
                case "not_configured":
                    return seedReplyView({
                        title: r.notConfiguredTitle,
                        body: r.notConfiguredBody,
                        action: link(input.planUrl, r.openInLogi),
                    })
                case "not_running":
                    return seedReplyView({
                        title: r.notRunningTitle,
                        body: r.notRunningBody,
                    })
            }
            break
        case "stopped":
            return seedReplyView({
                title: r.stoppedTitle(input.server),
                body: r.stoppedBody,
            })
        case "forbidden":
            return seedReplyView({
                title: r.forbiddenTitle,
                body: r.forbiddenBody,
            })
        case "not_found":
            return seedReplyView({
                title: r.notConfiguredTitle,
                body: r.notConfiguredBody,
                action: link(input.planUrl, r.openInLogi),
            })
        case "panel":
            return result.action === "pause"
                ? seedReplyView({
                      title: r.panelPausedTitle(input.server),
                      body: r.panelPausedBody(input.panelChannel ?? "—"),
                  })
                : result.action === "resume"
                  ? seedReplyView({
                        title: r.panelResumedTitle(input.server),
                        body: r.panelResumedBody(input.panelChannel ?? "—"),
                    })
                  : seedReplyView({
                        title: r.panelRefreshedTitle(input.server),
                        body: r.panelRefreshedBody,
                    })
        case "panel_missing":
            return seedReplyView({ title: r.noPanelTitle, body: r.noPanelBody })
        case "panel_not_sent":
            return seedReplyView({
                title: r.panelNotSentTitle,
                body: r.panelNotSentBody,
            })
    }
    return seedReplyView({ title: r.notRunningTitle, body: r.notRunningBody })
}

/** A private reply: the reason or result as the title, the next step, ≤ 1 button. */
export function seedReplyView(input: {
    title: string
    body: string
    action?: MessageButton
}): MessageView {
    return {
        accent: "clan",
        ephemeral: true,
        header: { title: input.title },
        blocks: [
            { kind: "text", markdown: input.body },
            ...(input.action
                ? [{ kind: "buttons" as const, buttons: [input.action] }]
                : []),
        ],
    }
}
