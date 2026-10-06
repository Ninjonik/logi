/**
 * The "Náhled" of every message row on "Zprávy a panely" (boards N1-08,
 * N1-B07): one sample {@link MessageView} per message the bot sends, drawn
 * with the shared preview, so the page shows what Discord shows. Every
 * message uses the builder the bot itself calls, with sample data and,
 * where the clan has set them, its own membership and ticket panels: the
 * announcement (`buildAnnouncementView`), the Discord event
 * (`buildScheduledEventContent`), rosters, forum, DMs, team requests, the
 * recruitment and ticket panels, the application and ticket cards, their
 * closing DMs, the player report and the errors channel. Pure: copy,
 * sample data and the clan's look come in.
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
    ticketClosedDmView,
    ticketIntroMentions,
    ticketIntroView,
    ticketPanelView,
    type TicketPanelCategory,
} from "../discord-tickets/ticket-views"
import {
    attendanceNoticeView,
    debriefView,
    forumInfoView,
    type ForumContext,
    type ForumEvent,
} from "./match-forum"
import {
    applicationCardView,
    applicationDecisionDmView,
    applicationPanelView,
} from "../membership/application-views"
import {
    buildAnnouncementView,
    matchCardFullTitle,
    type MatchCardEvent,
} from "./match-announcement"
import {
    resolveApplicationForm,
    type ApplicationCategory,
} from "../membership/application-form"
import {
    teamRequestDecisionView,
    type TeamRequestDmCopy,
} from "./team-request-dm"
import { buildScheduledEventContent } from "../events/scheduled-event-content"
import type { DirectMessageCopy, RosterMessageCopy } from "./match-copy"
import { applicationWindowCount } from "../membership/application-plan"
import type { MatchAnnouncementCopy } from "./match-announcement-copy"
import type { ApplicationCopy } from "../membership/application-copy"
import { escapeMarkdownText, type MessageView } from "./message-view"
import { botErrorReportView, type BotErrorsCopy } from "./bot-errors"
import type { ReportCopy } from "../discord-publications/panel-copy"
import { reportThreadView } from "../player-reports/report-views"
import type { TicketCopy } from "../discord-tickets/ticket-copy"
import { discordWeekdayTimestamp, fillTemplate } from "./format"
import type { MessageLayoutOptions } from "./message-layout"
import type { GameId } from "../games/game"

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
 * Sample data of the previews in the clan language
 * (`clan-language/system.ts` `previews`). The words of the messages come
 * from the bot's own copy; these are only the names, answers and reasons
 * of the samples.
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
    /** The clan role every member gets ("Klan"). */
    clanRole: string
    announcement: {
        /** The role ping above the card. */
        mention: string
        /** Sign-up groups: name, signed up, places ("Tanky 6/6"). */
        groups: Array<[string, number, number | null]>
    }
    /** Sample categories while the clan has no recruitment panel: name, game, line. */
    recruitmentPanel: {
        title: string
        body: string
        categories: Array<[string, GameId, string]>
    }
    application: {
        /** The applied category while the clan has none. */
        category: string
        answers: Array<[string, string]>
    }
    applicationClose: { reason: string }
    /** Sample categories while the clan has no ticket panel: name, line. */
    ticketPanel: {
        title: string
        body: string
        categories: Array<[string, string]>
    }
    ticket: {
        category: string
        /** The category's card title, "{author} nahlašuje hráče". */
        title: string
        answers: Array<[string, string]>
    }
    ticketClose: { reason: string }
    playerReport: {
        player: string
        /** The reported player's side as the server reports it. */
        side: string
        reporter: string
        reason: string
    }
    teamRequest: { game: string; team: string; code: string }
}

/** The clan's own panels the previews use instead of the samples, when set. */
export type SettingsPreviewClan = {
    membership?: {
        title: string
        text: string
        imageUrl?: string | null
        accentColor?: string | null
        categories: readonly ApplicationCategory[]
        /** The stored application form; invalid or missing uses the default form. */
        form?: unknown
        /** Variant B: the web form link when it is switched on. */
        webFormUrl?: string | null
    } | null
    tickets?: {
        title: string
        description?: string
        imageUrl?: string
        accentColor?: string | null
        categories: ReadonlyArray<
            TicketPanelCategory & { threadTitle?: string }
        >
    } | null
}

export type SettingsPreviewInput = {
    kind: SettingsPreviewKind
    samples: SettingsPreviewSamples
    dm: DirectMessageCopy & { locale: string }
    roster: RosterMessageCopy & { locale: string }
    errors: BotErrorsCopy
    teamRequests: TeamRequestDmCopy
    /** The bot's own copy of the announcement, applications, tickets and reports. */
    announcement: MatchAnnouncementCopy
    applications: ApplicationCopy
    tickets: TicketCopy
    reports: ReportCopy
    /** The clan's membership and ticket panels; the samples stand in without them. */
    clan?: SettingsPreviewClan
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
    /** Member and role names for mention pills in the sample. */
    users?: Record<string, string>
    roles?: Record<string, string>
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

/** The match of the samples as the announcement and the Discord event see it. */
function sampleCard(input: SettingsPreviewInput): MatchCardEvent {
    const { samples } = input
    return {
        kind: "match",
        eventId: "sample",
        guildId: "sample",
        name: `${samples.clanCode} vs ${samples.opponentCode}`,
        category: { label: samples.category, color: "#3ba55c" },
        teams: [
            { code: samples.clanCode, side: "Allies" },
            { code: samples.opponentCode, side: "Axis" },
        ],
        mapLabel: escapeMarkdownText(samples.map),
        meetingStart: MEETING,
        gameStart: GAME_START,
        registrationEnd: DEADLINE,
        timeZone: input.timeZone,
        locale: input.layout.locale,
    }
}

/** The announcement as the bot posts it while sign-ups are open (N1-08). */
function announcementPreview(input: SettingsPreviewInput): SettingsPreview {
    const { samples } = input
    const groups = samples.announcement.groups.map(([name, count, max]) => ({
        id: name,
        name,
        count,
        ...(max ? { max } : {}),
    }))
    return {
        content: samples.announcement.mention,
        view: buildAnnouncementView({
            event: sampleCard(input),
            state: "open",
            counts: {
                groups,
                withoutGroup: 0,
                total: groups.reduce((sum, group) => sum + group.count, 0),
                declined: 0,
            },
            meetingChannelId: MEETING_CHANNEL,
            links: { calendar: link(input.siteUrl, "/calendar") },
            copy: input.announcement,
        }),
    }
}

/**
 * The Discord scheduled event: its name and description as the bot writes
 * them (`buildScheduledEventContent`), with the meeting time and channel.
 */
function scheduledEventPreview(input: SettingsPreviewInput): SettingsPreview {
    const card = sampleCard(input)
    const content = buildScheduledEventContent({
        kind: "match",
        title: matchCardFullTitle(card, input.announcement),
        category: input.samples.category,
        opponent: input.samples.opponentCode,
        side: "Allies",
        mapLabel: input.samples.map,
        hasPassword: true,
        meetingStart: MEETING,
        gameStart: GAME_START,
        announcementChannelId: ANNOUNCEMENTS,
        locale: input.layout.locale,
        timeZone: input.timeZone,
        copy: input.announcement,
    })
    return {
        view: {
            accent: "clan",
            header: { title: content.name },
            blocks: [
                {
                    kind: "meta",
                    lines: [
                        {
                            line: "start",
                            text: `${discordWeekdayTimestamp(MEETING, input.layout.locale, input.timeZone) ?? ""} · <#${MEETING_CHANNEL}>`,
                        },
                    ],
                },
                { kind: "text", markdown: content.description },
            ],
        },
    }
}

/** The clan's recruitment categories, else the samples. */
function membershipOf(input: SettingsPreviewInput) {
    const own = input.clan?.membership
    if (own?.categories.length) return own
    const p = input.samples.recruitmentPanel
    const types = ["member", "reserve_member", "mercenary"] as const
    return {
        title: fillTemplate(p.title, { clan: input.samples.clan }),
        text: p.body,
        imageUrl: null,
        accentColor: null,
        categories: p.categories.map(
            ([label, gameId, description], index): ApplicationCategory => ({
                id: `sample-${index}`,
                label,
                gameId,
                description,
                assignmentType: types[index % types.length]!,
            })
        ),
        form: undefined,
        webFormUrl: null,
    }
}

/** The clan's ticket categories, else the samples. */
function ticketsOf(input: SettingsPreviewInput) {
    const own = input.clan?.tickets
    if (own?.categories.length) return own
    const p = input.samples.ticketPanel
    return {
        title: p.title,
        description: p.body,
        imageUrl: undefined,
        accentColor: null,
        categories: p.categories.map(([label, description], index) => ({
            id: `sample-${index}`,
            label,
            description,
            ...(index === 0 ? { threadTitle: input.samples.ticket.title } : {}),
        })),
    }
}

/** One sample per message row; the same builders as the bot where they exist. */ /** One sample per message row; the same builders as the bot where they exist. */
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
            return { channels, ...scheduledEventPreview(input) }
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
            const panel = membershipOf(input)
            return {
                view: applicationPanelView(input.applications, {
                    title: panel.title,
                    text: panel.text,
                    imageUrl: panel.imageUrl,
                    accentColor: panel.accentColor,
                    categories: panel.categories,
                    windows: applicationWindowCount(
                        resolveApplicationForm(
                            panel.form,
                            panel.categories,
                            input.applications.defaultForm
                        ),
                        panel.categories
                    ),
                    webFormUrl: panel.webFormUrl,
                    managedUrl: input.siteUrl,
                }),
            }
        }
        case "application": {
            const category = membershipOf(input).categories[0]
            const applicant = PLAYER_IDS[0]!
            return {
                users: { [applicant]: samples.players[0] ?? "" },
                view: applicationCardView(input.applications, {
                    number: 42,
                    games: [category?.gameId ?? "hell_let_loose"],
                    applicantId: applicant,
                    applicantName: samples.players[0] ?? "",
                    categoryLabel:
                        category?.label?.trim() || samples.application.category,
                    submittedAt: new Date(input.now).toISOString(),
                    timeZone: input.timeZone,
                    inGameName: samples.players[0],
                    accounts: {
                        steam: "76561198000000017",
                        steamVerified: false,
                    },
                    answers: samples.application.answers.map(
                        ([label, value], index) => ({
                            questionId: `sample-${index}`,
                            kind: "custom" as const,
                            label,
                            value,
                        })
                    ),
                    supportRoleIds: [],
                    mercenaryAvailable: true,
                }),
            }
        }
        case "applicationClose":
            return {
                view: applicationDecisionDmView(input.applications, {
                    clanName: samples.clan,
                    number: 42,
                    outcome: "member",
                    gameId: "hell_let_loose",
                    reason: samples.applicationClose.reason,
                    roleNames: [samples.clanRole, samples.memberRole],
                    threadUrl: link(input.siteUrl, "/discord"),
                    settingsUrl: frame.settingsUrl,
                }),
            }
        case "ticketPanel": {
            const panel = ticketsOf(input)
            return {
                view: ticketPanelView({
                    title: panel.title,
                    description: panel.description,
                    imageUrl: panel.imageUrl,
                    accentColor: panel.accentColor,
                    categories: panel.categories,
                    copy: input.tickets,
                    managedUrl: input.siteUrl,
                }),
            }
        }
        case "ticket": {
            const category = ticketsOf(input).categories[0]
            const author = PLAYER_IDS[0]!
            const label = category?.label?.trim() || samples.ticket.category
            return {
                content: ticketIntroMentions({
                    authorId: author,
                    supportRoleIds: [],
                }).content,
                users: { [author]: samples.players[0] ?? "" },
                view: ticketIntroView({
                    copy: input.tickets,
                    ticketNumber: 12,
                    category: label,
                    titleTemplate: category?.threadTitle,
                    authorName: samples.players[0] ?? "",
                    openedAt: GAME_START,
                    answers: samples.ticket.answers.map(
                        ([question, value]) => ({
                            label: question,
                            value,
                        })
                    ),
                    locale: input.layout.locale,
                    timeZone: input.timeZone,
                    accentColor: null,
                }),
            }
        }
        case "ticketClose": {
            const category = ticketsOf(input).categories[0]
            return {
                view: ticketClosedDmView({
                    copy: input.tickets,
                    clanName: samples.clan,
                    ticketNumber: 12,
                    category:
                        category?.label?.trim() || samples.ticket.category,
                    closerName: samples.leader,
                    reason: samples.ticketClose.reason,
                    threadUrl: link(input.siteUrl, "/discord"),
                    settingsUrl: frame.settingsUrl,
                }),
            }
        }
        case "playerReport": {
            const report = samples.playerReport
            const reporter = PLAYER_IDS[5]!
            const side = report.side.trim().toLowerCase()
            return {
                users: { [reporter]: report.reporter },
                view: reportThreadView({
                    copy: input.reports,
                    number: 17,
                    context: {
                        gameId: "hell_let_loose",
                        serverName: `${samples.clan} #1`,
                        map: samples.map.split(" · ")[0] ?? samples.map,
                        observedAt: GAME_START,
                        player: {
                            name: report.player,
                            playerId: null,
                            team: report.side,
                            provenance: "observed",
                        },
                        reason: report.reason,
                        incident: "",
                        evidence: "",
                    },
                    reporterId: reporter,
                    sideName:
                        side === "allies" || side === "axis"
                            ? input.roster.factions[side]
                            : null,
                    observedText: null,
                    serverTitle: `${samples.clan} #1`,
                }),
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
