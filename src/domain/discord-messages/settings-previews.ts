/**
 * The "Náhled" of every message row on "Zprávy a panely" (board N1-B07):
 * one sample {@link MessageView} per message the bot sends, drawn with the
 * shared preview, so the page shows what Discord shows. Messages whose
 * builder lives in the domain (rosters, forum, DMs, team requests, errors
 * channel) use that builder with sample data; the announcement and the
 * membership and ticket cards use the board's anatomy and words until
 * their builders move into the domain (W6a, W7). Pure: copy, sample data
 * and the clan's look come in.
 */

import {
    attendanceConfirmedReply,
    attendanceReminderView,
    matchRecapView,
    rosterChangeDmView,
    signupReminderView,
    trainingResultView,
    type DmEvent,
    type DmFrame,
} from "./direct-message-views"
import {
    rosterChangesView,
    rosterMessageView,
    type RosterCardContext,
    type RosterCardEvent,
    type RosterCardRoster,
    type RosterMessageVariant,
} from "./roster-message"
import {
    attendanceNoticeView,
    debriefView,
    forumInfoView,
    type ForumContext,
    type ForumEvent,
} from "./match-forum"
import {
    escapeMarkdownText,
    type MessageBlock,
    type MessageView,
} from "./message-view"
import {
    teamRequestDecisionView,
    type TeamRequestDmCopy,
} from "./team-request-dm"
import type { DirectMessageCopy, RosterMessageCopy } from "./match-copy"
import { botErrorReportView, type BotErrorsCopy } from "./bot-errors"
import { discordWeekdayTimestamp, fillTemplate } from "./format"
import type { MessageLayoutOptions } from "./message-layout"

/** Every row of "Co bot posílá" with a preview, in board order. */
export const SETTINGS_PREVIEW_KINDS = [
    "announcement",
    "roster",
    "rosterChanges",
    "forum",
    "debrief",
    "attendanceNotice",
    "scheduledEvent",
    "signupReminder",
    "attendanceReminder",
    "matchRecap",
    "trainingResult",
    "rosterChangeDm",
    "teamRequest",
    "buttonReplies",
    "recruitmentPanel",
    "application",
    "applicationClose",
    "ticketPanel",
    "ticket",
    "ticketClose",
    "playerReport",
    "errors",
] as const

export type SettingsPreviewKind = (typeof SETTINGS_PREVIEW_KINDS)[number]

/**
 * Sample data and the words of the cards whose builders are not in the
 * domain yet, in the clan language (`clan-language/system.ts` `previews`).
 */
export type SettingsPreviewSamples = {
    clan: string
    clanCode: string
    opponentCode: string
    category: string
    /** "Foy · den". */
    map: string
    recapMap: string
    /** Sample players; the first one is "Hráč 17". */
    players: string[]
    leader: string
    squads: string[]
    role: string
    meetingChannel: string
    trainingTitle: string
    rewardRole: string
    memberRole: string
    announcement: {
        mention: string
        signUp: string
        editSignup: string
        decline: string
        /** "**Přihlášeno {count}** · Pěchota 15 · Tanky 6/6 · Recon 2/2". */
        signedUp: string
        /** "{map} · sraz {meeting} · přihlášky do {deadline}". */
        facts: string
    }
    recruitmentPanel: {
        title: string
        body: string
        categories: string[]
        button: string
    }
    application: {
        intro: string
        label: string
        title: string
        chip: string
        /** "Podáno {date} · Steam 76561198000000017". */
        submitted: string
        answers: Array<[string, string]>
        footer: string
    }
    applicationClose: {
        label: string
        title: string
        body: string
        reason: string
        openThread: string
    }
    ticketPanel: {
        title: string
        body: string
        categories: Array<[string, string]>
    }
    ticket: {
        label: string
        title: string
        chip: string
        /** "Otevřeno {date}". */
        opened: string
        answers: Array<[string, string]>
        footer: string
    }
    ticketClose: {
        label: string
        title: string
        line: string
        reason: string
        openThread: string
    }
    playerReport: {
        label: string
        title: string
        lines: string[]
        reason: string
        footer: string
    }
    teamRequest: { game: string; team: string; code: string }
}

export type SettingsPreviewInput = {
    kind: SettingsPreviewKind
    samples: SettingsPreviewSamples
    dm: DirectMessageCopy & { locale: string }
    roster: RosterMessageCopy & { locale: string }
    errors: BotErrorsCopy
    teamRequests: TeamRequestDmCopy
    /** Frame words, locale and the clan's look, as the bot lays out. */
    layout: MessageLayoutOptions
    timeZone: string
    /** The fixed "now" of the samples; the match is six days later. */
    now: number
    rosterVariant: RosterMessageVariant
    /** Absolute base for the sample links ("https://logi.app"). */
    siteUrl: string
}

/** What the page draws: the view, and whose message it is. */
export type SettingsPreview = {
    view: MessageView
    /** The content line above the card (role pings of an announcement). */
    content?: string
    /** Channel names for mention pills in the sample. */
    channels?: Record<string, string>
    /** A private reply or command answer (shows "used /…"). */
    invokedBy?: { user: string; command: string }
}

/** The samples' fixed clock: Monday 5 October 2026, 18:02 in Prague. */
export const SETTINGS_PREVIEW_NOW = Date.parse("2026-10-05T16:02:00Z")
const GAME_START = "2026-10-11T18:00:00.000Z"
const MEETING = "2026-10-11T17:30:00.000Z"
const DEADLINE = "2026-10-10T17:30:00.000Z"
const MEETING_CHANNEL = "100000000000000001"
const ANNOUNCEMENTS = "100000000000000002"
const THREADS = "100000000000000003"
const PLAYER_IDS = [
    "200000000000000017",
    "200000000000000021",
    "200000000000000023",
    "200000000000000031",
    "200000000000000032",
    "200000000000000033",
]

const link = (siteUrl: string, path: string) =>
    new URL(path, siteUrl).toString()

function sampleEvent(input: SettingsPreviewInput): RosterCardEvent & {
    teams: DmEvent["teams"]
} {
    const { samples } = input
    return {
        id: "sample",
        title: `${samples.clanCode} vs ${samples.opponentCode}`,
        category: samples.category,
        teams: [
            {
                slot: "a",
                side: "Allies",
                snapshot: { name: samples.clan, shortCode: samples.clanCode },
            },
            {
                slot: "b",
                side: "Axis",
                snapshot: {
                    name: samples.opponentCode,
                    shortCode: samples.opponentCode,
                },
            },
        ],
        mapLabel: escapeMarkdownText(samples.map),
        registrationEnd: DEADLINE,
        meetingStart: MEETING,
        gameStart: GAME_START,
        meetingChannelId: MEETING_CHANNEL,
    }
}

function frameOf(input: SettingsPreviewInput): DmFrame {
    return {
        clanName: input.samples.clan,
        settingsUrl: link(
            input.siteUrl,
            "/dashboard/settings/user#zpravy-od-bota"
        ),
        timeZone: input.timeZone,
    }
}

function sampleRoster(input: SettingsPreviewInput): {
    roster: RosterCardRoster
    names: Record<string, string>
} {
    const { samples } = input
    const names = Object.fromEntries(
        PLAYER_IDS.map((id, index) => [id, samples.players[index] ?? id])
    )
    const [able = "Able", baker = "Baker"] = samples.squads
    return {
        names,
        roster: {
            squads: [
                {
                    name: able,
                    group: "",
                    order: 0,
                    players: [
                        { id: PLAYER_IDS[3], roleName: "Officer", ack: true },
                        {
                            id: PLAYER_IDS[0],
                            roleName: samples.role,
                            ack: true,
                            confirmed: true,
                        },
                        { id: PLAYER_IDS[1], roleName: "Rifleman", ack: false },
                    ],
                },
                {
                    name: baker,
                    group: "",
                    order: 1,
                    players: [
                        { id: PLAYER_IDS[4], roleName: "Officer", ack: true },
                        {
                            id: PLAYER_IDS[2],
                            roleName: "Anti-Tank",
                            ack: false,
                        },
                    ],
                },
            ],
            reservePlayerIds: [PLAYER_IDS[5]!],
        },
    }
}

function rosterContext(
    input: SettingsPreviewInput,
    names: Record<string, string>
): RosterCardContext {
    return {
        copy: input.roster,
        timeZone: input.timeZone,
        names,
        rosterUrl: link(input.siteUrl, "/rosters/sample"),
        now: input.now,
    }
}

const forumContext = (input: SettingsPreviewInput): ForumContext => ({
    copy: input.roster,
    timeZone: input.timeZone,
})

function answers(pairs: Array<[string, string]>): MessageBlock[] {
    return pairs.map(([question, answer]) => ({
        kind: "text" as const,
        markdown: `**${escapeMarkdownText(question)}**\n${escapeMarkdownText(answer)}`,
    }))
}

/** The announcement card as the board draws it (N1-08). */
function announcementPreview(input: SettingsPreviewInput): SettingsPreview {
    const { samples } = input
    const a = samples.announcement
    const event = sampleEvent(input)
    const when = discordWeekdayTimestamp(
        GAME_START,
        input.layout.locale,
        input.timeZone
    )
    const deadline = discordWeekdayTimestamp(
        DEADLINE,
        input.layout.locale,
        input.timeZone
    )
    return {
        content: a.mention,
        view: {
            accent: "clan",
            header: {
                title: event.title,
                chips: [{ label: samples.category, tone: "success" }],
            },
            blocks: [
                {
                    kind: "meta",
                    lines: [
                        {
                            line: "side",
                            text: `**${samples.clanCode}** ${input.roster.factions.allies} ★  vs  **${samples.opponentCode}** ${input.roster.factions.axis} ✚`,
                        },
                        {
                            line: "start",
                            text: `**${when ?? ""}** · <t:${Date.parse(GAME_START) / 1000}:R>`,
                        },
                        {
                            line: "details",
                            text: fillTemplate(a.facts, {
                                map: escapeMarkdownText(samples.map),
                                meeting: `<t:${Date.parse(MEETING) / 1000}:t>`,
                                deadline: deadline ?? "",
                            }),
                        },
                        { line: "status", text: a.signedUp },
                    ],
                },
                {
                    kind: "buttons",
                    buttons: [
                        {
                            kind: "action",
                            id: "preview:signup",
                            label: a.signUp,
                            style: "success",
                        },
                        {
                            kind: "action",
                            id: "preview:edit",
                            label: a.editSignup,
                            style: "secondary",
                        },
                        {
                            kind: "action",
                            id: "preview:decline",
                            label: a.decline,
                            style: "danger",
                        },
                    ],
                },
            ],
            footer: { kind: "managed" },
        },
    }
}

/** One sample per message row; the same builders as the bot where they exist. */
export function settingsPreview(input: SettingsPreviewInput): SettingsPreview {
    const { samples } = input
    const event = sampleEvent(input)
    const frame = frameOf(input)
    const channels = {
        [MEETING_CHANNEL]: samples.meetingChannel,
        [ANNOUNCEMENTS]: "oznameni",
        [THREADS]: "prihlasky",
    }
    switch (input.kind) {
        case "announcement":
            return announcementPreview(input)
        case "roster": {
            const { roster, names } = sampleRoster(input)
            return {
                channels,
                view: rosterMessageView(
                    {
                        event,
                        roster,
                        variant: input.rosterVariant,
                        image: {
                            url: link(
                                input.siteUrl,
                                "/images/roster-sample.png"
                            ),
                            description: input.roster.message.imageDescription,
                        },
                        publishedAt: new Date(input.now).toISOString(),
                    },
                    rosterContext(input, names),
                    input.layout
                ),
            }
        }
        case "rosterChanges": {
            const { names } = sampleRoster(input)
            const [able = "Able", baker = "Baker"] = samples.squads
            return {
                view: rosterChangesView({
                    event,
                    editedAt: new Date(input.now).toISOString(),
                    context: rosterContext(input, names),
                    changes: [
                        {
                            userId: PLAYER_IDS[1]!,
                            before: { squad: able, role: "Rifleman" },
                            after: { squad: baker, role: "Rifleman" },
                            added: false,
                            removed: false,
                            toReserves: false,
                            moved: true,
                            roleChanged: false,
                        },
                        {
                            userId: PLAYER_IDS[5]!,
                            after: { squad: able, role: samples.role },
                            added: true,
                            removed: false,
                            toReserves: false,
                            moved: false,
                            roleChanged: false,
                        },
                    ],
                }),
            }
        }
        case "forum": {
            const forumEvent: ForumEvent = {
                ...event,
                category: { label: samples.category },
                side: "Allies",
                server: `${samples.clan} #2`,
                hasPassword: true,
            }
            return {
                channels,
                view: forumInfoView({
                    event: forumEvent,
                    stratmaps: [],
                    context: forumContext(input),
                }),
            }
        }
        case "debrief":
            return {
                view: debriefView({
                    event: {
                        title: event.title,
                        category: { label: samples.category },
                        gameStart: GAME_START,
                        mapLabel: event.mapLabel,
                    },
                    result: {
                        outcome: "win",
                        score: "3 : 2",
                        matchUrl: link(input.siteUrl, "/matches/sample"),
                    },
                    context: forumContext(input),
                }),
            }
        case "attendanceNotice":
            return {
                view: attendanceNoticeView({
                    kind: "late",
                    name: samples.players[0] ?? "",
                    event: { title: event.title, gameStart: GAME_START },
                    place: {
                        squad: samples.squads[0] ?? "",
                        role: samples.role,
                    },
                    attendanceUrl: link(
                        input.siteUrl,
                        "/dashboard?tab=attendance"
                    ),
                    context: forumContext(input),
                }),
            }
        case "scheduledEvent":
            // The Discord event itself is drawn by the page; this card is
            // what members see in the event's description.
            return {
                channels,
                view: {
                    accent: "clan",
                    header: { title: event.title },
                    blocks: [
                        {
                            kind: "meta",
                            lines: [
                                {
                                    line: "start",
                                    text: `${discordWeekdayTimestamp(MEETING, input.layout.locale, input.timeZone) ?? ""} · <#${MEETING_CHANNEL}>`,
                                },
                                {
                                    line: "details",
                                    text: escapeMarkdownText(samples.map),
                                },
                            ],
                        },
                    ],
                },
            }
        case "signupReminder":
            return {
                channels,
                view: signupReminderView({
                    event: {
                        ...event,
                        category: { label: samples.category },
                    },
                    ids: {
                        signUp: "preview:signup",
                        decline: "preview:decline",
                    },
                    copy: input.dm,
                    rosterCopy: input.roster,
                    frame,
                }),
            }
        case "attendanceReminder":
            return {
                view: attendanceReminderView({
                    event,
                    place: {
                        kind: "squad",
                        squad: samples.squads[0] ?? "",
                        role: samples.role,
                        leader: escapeMarkdownText(samples.leader),
                    },
                    now: Date.parse(GAME_START) - 6 * 3600_000,
                    copy: input.dm,
                    frame,
                }),
            }
        case "matchRecap":
            return {
                view: matchRecapView({
                    event: {
                        id: "sample",
                        title: event.title,
                        category: { label: samples.category },
                        gameStart: GAME_START,
                        mapLabel: escapeMarkdownText(samples.recapMap),
                    },
                    gameId: "hell_let_loose",
                    result: {
                        outcome: "win",
                        score: "3 : 2",
                        team: samples.clanCode,
                        side: "Allies",
                    },
                    stats: {
                        kills: 34,
                        deaths: 12,
                        kd: 34 / 12,
                        previous: {
                            matches: 10,
                            kills: 21,
                            deaths: 14,
                            kd: 1.5,
                        },
                    },
                    statsUrl: link(input.siteUrl, "/matches/sample"),
                    settingsUrl: frame.settingsUrl,
                    enabled: true,
                    copy: input.dm,
                    rosterCopy: input.roster,
                    frame,
                }),
            }
        case "trainingResult":
            return {
                view: trainingResultView({
                    title: samples.trainingTitle,
                    gameStart: GAME_START,
                    passed: true,
                    rewardRoles: [samples.rewardRole],
                    copy: input.dm,
                    frame,
                }),
            }
        case "rosterChangeDm": {
            const [able = "Able", baker = "Baker"] = samples.squads
            return {
                view: rosterChangeDmView({
                    event,
                    change: {
                        userId: PLAYER_IDS[0]!,
                        before: { squad: able, role: "Rifleman" },
                        after: { squad: baker, role: samples.role },
                        added: false,
                        removed: false,
                        toReserves: false,
                        moved: true,
                        roleChanged: true,
                    },
                    leader: escapeMarkdownText(samples.leader),
                    rosterUrl: link(input.siteUrl, "/rosters/sample"),
                    copy: input.dm,
                    rosterCopy: input.roster,
                    frame,
                }),
            }
        }
        case "teamRequest":
            return {
                view: teamRequestDecisionView({
                    copy: input.teamRequests,
                    gameLabel: samples.teamRequest.game,
                    status: "approved",
                    kind: "create",
                    requestedName: samples.teamRequest.team,
                    team: {
                        name: samples.teamRequest.team,
                        code: samples.teamRequest.code,
                    },
                    reason: null,
                    teamUrl: link(input.siteUrl, "/dashboard"),
                    frame,
                }),
            }
        case "buttonReplies":
            return {
                channels,
                view: attendanceConfirmedReply({
                    event: {
                        meetingStart: MEETING,
                        meetingChannelId: MEETING_CHANNEL,
                    },
                    copy: input.dm,
                    dateAt: input.roster.common.dateAt,
                    timeZone: input.timeZone,
                    dm: false,
                }),
            }
        case "recruitmentPanel": {
            const p = samples.recruitmentPanel
            return {
                view: {
                    accent: "clan",
                    header: {
                        title: fillTemplate(p.title, { clan: samples.clan }),
                    },
                    blocks: [
                        { kind: "text", markdown: p.body },
                        {
                            kind: "list",
                            marker: "none",
                            items: p.categories.map((line) =>
                                escapeMarkdownText(line)
                            ),
                        },
                        { kind: "separator", divider: true, spacing: "small" },
                        {
                            kind: "buttons",
                            buttons: [
                                {
                                    kind: "action",
                                    id: "preview:apply",
                                    label: p.button,
                                    style: "primary",
                                },
                            ],
                        },
                    ],
                    footer: { kind: "managed" },
                },
            }
        }
        case "application": {
            const p = samples.application
            const date = discordWeekdayTimestamp(
                GAME_START,
                input.layout.locale,
                input.timeZone
            )
            return {
                content: p.intro,
                view: {
                    accent: "clan",
                    header: {
                        label: p.label,
                        title: p.title,
                        chips: [{ label: p.chip, tone: "warning" }],
                        status: fillTemplate(p.submitted, { date: date ?? "" }),
                    },
                    blocks: [
                        ...answers(p.answers),
                        { kind: "separator", divider: true, spacing: "small" },
                    ],
                    footer: { kind: "managed", notes: [p.footer] },
                },
            }
        }
        case "applicationClose": {
            const p = samples.applicationClose
            return {
                view: {
                    accent: "clan",
                    header: {
                        label: fillTemplate(p.label, { clan: samples.clan }),
                        title: p.title,
                    },
                    blocks: [
                        { kind: "text", markdown: p.body },
                        {
                            kind: "text",
                            markdown: `> ${escapeMarkdownText(p.reason)}`,
                        },
                        {
                            kind: "buttons",
                            buttons: [
                                {
                                    kind: "link",
                                    url: link(input.siteUrl, "/discord"),
                                    label: p.openThread,
                                },
                            ],
                        },
                        { kind: "separator", divider: true, spacing: "small" },
                    ],
                    footer: {
                        kind: "dm",
                        clanName: frame.clanName,
                        settingsUrl: frame.settingsUrl,
                    },
                },
            }
        }
        case "ticketPanel": {
            const p = samples.ticketPanel
            return {
                view: {
                    accent: "clan",
                    header: { title: p.title },
                    blocks: [
                        { kind: "text", markdown: p.body },
                        {
                            kind: "list",
                            marker: "none",
                            items: p.categories.map(
                                ([label, hint]) =>
                                    `**${escapeMarkdownText(label)}** · ${escapeMarkdownText(hint)}`
                            ),
                        },
                        { kind: "separator", divider: true, spacing: "small" },
                        {
                            kind: "buttons",
                            buttons: p.categories
                                .slice(0, 5)
                                .map(([label], index) => ({
                                    kind: "action" as const,
                                    id: `preview:ticket:${index}`,
                                    label,
                                    style: "secondary" as const,
                                })),
                        },
                    ],
                    footer: { kind: "managed" },
                },
            }
        }
        case "ticket": {
            const p = samples.ticket
            const date = discordWeekdayTimestamp(
                GAME_START,
                input.layout.locale,
                input.timeZone
            )
            return {
                view: {
                    accent: "clan",
                    header: {
                        label: p.label,
                        title: p.title,
                        chips: [{ label: p.chip, tone: "info" }],
                        status: fillTemplate(p.opened, { date: date ?? "" }),
                    },
                    blocks: [
                        ...answers(p.answers),
                        { kind: "separator", divider: true, spacing: "small" },
                    ],
                    footer: { kind: "managed", notes: [p.footer] },
                },
            }
        }
        case "ticketClose": {
            const p = samples.ticketClose
            return {
                view: {
                    accent: "clan",
                    header: {
                        label: fillTemplate(p.label, { clan: samples.clan }),
                        title: p.title,
                    },
                    blocks: [
                        { kind: "text", markdown: p.line },
                        {
                            kind: "text",
                            markdown: `> ${escapeMarkdownText(p.reason)}`,
                        },
                        {
                            kind: "buttons",
                            buttons: [
                                {
                                    kind: "link",
                                    url: link(input.siteUrl, "/discord"),
                                    label: p.openThread,
                                },
                            ],
                        },
                        { kind: "separator", divider: true, spacing: "small" },
                    ],
                    footer: {
                        kind: "dm",
                        clanName: frame.clanName,
                        settingsUrl: frame.settingsUrl,
                    },
                },
            }
        }
        case "playerReport": {
            const p = samples.playerReport
            return {
                view: {
                    accent: "clan",
                    header: { label: p.label, title: p.title },
                    blocks: [
                        {
                            kind: "meta",
                            lines: p.lines.map((text) => ({ text })),
                        },
                        {
                            kind: "text",
                            markdown: escapeMarkdownText(p.reason),
                        },
                        { kind: "separator", divider: true, spacing: "small" },
                    ],
                    footer: {
                        kind: "managed",
                        notes: [p.footer],
                        managed: false,
                    },
                },
            }
        }
        case "errors":
            return {
                channels: { [ANNOUNCEMENTS]: "oznameni" },
                view: botErrorReportView({
                    copy: input.errors,
                    locale: input.layout.locale,
                    timeZone: input.timeZone,
                    source: "announcement",
                    facts: {
                        failure: "missingPermission",
                        channel: `<#${ANNOUNCEMENTS}>`,
                        missingPermissions: ["EmbedLinks"],
                    },
                    context: {
                        event: {
                            title: event.title,
                            category: samples.category,
                            gameStart: GAME_START,
                        },
                    },
                    links: {
                        match: link(input.siteUrl, "/dashboard"),
                        channels: link(input.siteUrl, "/dashboard"),
                        managed: link(input.siteUrl, "/dashboard"),
                    },
                }),
            }
    }
}
