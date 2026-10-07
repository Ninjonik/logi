/**
 * Prints the announcement family for the board's example match as Discord
 * text, one state after another, to compare with board L1:
 *
 *     npx tsx discord-bot/src/events/dump-board.ts
 */

import {
    BOARD_NOW,
    boardEvent,
    boardPayload,
    boardRoster,
    withLimits,
} from "./board-example.fixture"
import { buildAttendeesView } from "../../../src/domain/discord-messages/match-attendees"
import { layoutMessageView } from "../../../src/domain/discord-messages/message-layout"
import { getAnnouncementMessages } from "../../../src/lib/clan-language/announcements"
import type { MessageView } from "../../../src/domain/discord-messages/message-view"
import { buildSignupList } from "../../../src/domain/events/signup-list"
import { buildAnnouncementCard, matchCardEventOf } from "./announcement"
import { messageKitLayoutOptions } from "../ui/message-kit"

function print(title: string, view: MessageView) {
    const layout = layoutMessageView(
        view,
        messageKitLayoutOptions({ language: "cs" })
    )
    console.log(`\n===== ${title} =====`)
    for (const node of layout.nodes) {
        if (node.type === "text") console.log(node.content)
        else if (node.type === "section")
            console.log(
                `${node.texts.join("\n")}   [thumb ${node.thumbnail.url}]`
            )
        else if (node.type === "separator") console.log("────────")
        else if (node.type === "buttons")
            console.log(
                node.buttons
                    .map((button) =>
                        button.kind === "link"
                            ? `[${button.label} ↗]`
                            : `[${button.label}${button.disabled ? " (off)" : ""} · ${button.style} · ${button.id}]`
                    )
                    .join(" ")
            )
        else if (node.type === "select")
            console.log(
                `<select ${node.select.id}: ${node.select.options
                    .map(
                        (option) =>
                            `${option.label} (${option.description ?? ""})`
                    )
                    .join(" | ")}>`
            )
        else if (node.type === "gallery")
            console.log(
                `[gallery ${node.items.map((item) => item.url).join(", ")}]`
            )
    }
}

const at = (iso: string) => new Date(iso)
const open = withLimits(boardEvent())
print(
    "Přihlášky otevřené",
    buildAnnouncementCard(boardPayload(open), open, {
        now: BOARD_NOW,
        forumChannelId: "666666666666666666",
        thumbnail: {
            url: "attachment://logi-panel-mapa-foy.webp",
            description: "mapa Foy",
        },
        announcementChannelId: "333333333333333333",
        clanName: "Vlci",
        meetingChannelName: "Sraz",
    }).view
)
const fullParticipants = [
    ...open.participants,
    {
        userId: "tank-5",
        status: "attending" as const,
        group: "Tanky",
        updatedAt: "x",
    },
    {
        userId: "tank-6",
        status: "attending" as const,
        group: "Tanky",
        updatedAt: "x",
    },
    {
        userId: "recon-2",
        status: "attending" as const,
        group: "Recon",
        updatedAt: "x",
    },
    {
        userId: "res-1",
        status: "attending" as const,
        group: null,
        requestedGroup: "Tanky",
        updatedAt: "x",
    },
    {
        userId: "res-2",
        status: "attending" as const,
        group: null,
        requestedGroup: "Recon",
        updatedAt: "x",
    },
    {
        userId: "kos",
        status: "not_attending" as const,
        group: null,
        updatedAt: "x",
    },
]
const full = withLimits(boardEvent({ participants: fullParticipants }))
print(
    "Skupina plná",
    buildAnnouncementCard(boardPayload(full), full, {
        now: at("2026-10-08T16:00:00.000Z"),
        forumChannelId: "666666666666666666",
    }).view
)
const closed = withLimits(
    boardEvent({ participants: fullParticipants, status: "closed" })
)
print(
    "Přihlášky uzavřené",
    buildAnnouncementCard(boardPayload(closed), closed, {
        now: at("2026-10-10T18:00:00.000Z"),
        forumChannelId: "666666666666666666",
    }).view
)
const starting = withLimits(
    boardEvent({ participants: fullParticipants, status: "starting" })
)
print(
    "Soupiska zveřejněna",
    buildAnnouncementCard(boardPayload(starting, [boardRoster]), starting, {
        now: at("2026-10-11T13:00:00.000Z"),
        forumChannelId: "666666666666666666",
        rosterChannelId: "777777777777777777",
    }).view
)
const meeting = withLimits(
    boardEvent({
        participants: fullParticipants,
        status: "starting",
        absenceNotices: [
            { userId: "p16", reason: "Ve 20:15", createdAt: "x", kind: "late" },
            {
                userId: "p17",
                reason: "nemoc",
                createdAt: "x",
                kind: "cannot_come",
            },
        ],
    })
)
print(
    "Začíná",
    buildAnnouncementCard(boardPayload(meeting, [boardRoster]), meeting, {
        now: at("2026-10-11T17:35:00.000Z"),
        forumChannelId: "666666666666666666",
        rosterChannelId: "777777777777777777",
    }).view
)
print(
    "Hraje se",
    buildAnnouncementCard(boardPayload(meeting, [boardRoster]), meeting, {
        now: at("2026-10-11T18:05:00.000Z"),
        forumChannelId: "666666666666666666",
        rosterChannelId: "777777777777777777",
    }).view
)
const played = withLimits(
    boardEvent({
        participants: fullParticipants,
        status: "concluded",
        concludedAt: "2026-10-11T20:15:00.000Z",
    })
)
print(
    "Odehráno",
    buildAnnouncementCard(boardPayload(played, [boardRoster]), played, {
        now: at("2026-10-11T20:40:00.000Z"),
        result: { outcome: "win", scores: [4, 1], reviewer: "Kowalski" },
        publicMatch: true,
        resultsChannelId: "888888888888888888",
    }).view
)
const cancelled = withLimits(
    boardEvent({ status: "concluded", concludedAt: "2026-10-09T10:00:00.000Z" })
)
print(
    "Zrušeno",
    buildAnnouncementCard(boardPayload(cancelled), cancelled, {
        now: at("2026-10-09T10:05:00.000Z"),
        scheduledEvent: true,
    }).view
)
const training = boardEvent({
    kind: "training",
    name: "komunikace a souhra",
    matchType: undefined,
    matchTeams: [],
    server: "Vlci Trénink",
    notes: "Nácvik komunikace, přesunů a spolupráce čet. Vezmi si sluchátka s mikrofonem.",
    registrationEnd: "2026-10-12T15:00:00.000Z",
    meetingStart: "2026-10-12T16:45:00.000Z",
    gameStart: "2026-10-12T17:00:00.000Z",
    gameEnd: "2026-10-12T19:00:00.000Z",
    participants: [
        ...Array.from({ length: 8 }, (_, i) => ({
            userId: `t${i}`,
            status: "attending" as const,
            group: "ATTEND",
            updatedAt: "x",
        })),
        {
            userId: "t9",
            status: "not_attending" as const,
            group: null,
            updatedAt: "x",
        },
    ],
})
print(
    "Trénink",
    buildAnnouncementCard(boardPayload(training), training, {
        now: at("2026-10-06T07:15:00.000Z"),
    }).view
)

const copy = getAnnouncementMessages("cs")
const card = matchCardEventOf({
    config: boardPayload(closed).config,
    event: closed,
    category: { label: "Přátelák", color: "#3ba55c" },
})
const names = new Map<string, string>([
    ["inf-1", "Kowalski"],
    ["inf-2", "Rex_CZ"],
    ["tank-1", "Tomcat"],
    ["res-1", "Fík"],
    ["res-2", "Dub"],
    ["kos", "Kos"],
    ["u1", "Sokol"],
    ["u2", "Jestřáb"],
])
for (const leadership of [false, true]) {
    const list = buildSignupList({
        groups: boardGroups(),
        offeredGroupIds: ["inf", "tank", "recon"],
        limits: new Map([
            ["tank", 6],
            ["recon", 2],
        ]),
        participants: closed.participants,
        absenceNotices: [
            {
                userId: "inf-6",
                reason: "Ve 20:15, končím v práci",
                createdAt: "x",
                kind: "late",
            },
            {
                userId: "kos",
                reason: "nemoc",
                createdAt: "x",
                kind: "cannot_come",
            },
        ],
        memberships: new Map([
            ["inf-1", "member"],
            ["inf-2", "member"],
            ["res-1", "reserve_member"],
            ["inf-12", "recruit"],
        ]),
        signedUpAt: new Map([
            ["inf-1", "2026-10-05T16:04:00.000Z"],
            ["inf-2", "2026-10-05T16:05:00.000Z"],
        ]),
        leadership,
        unanswered: leadership ? ["u1", "u2"] : [],
        names,
        locale: "cs-CZ",
    })
    print(
        leadership
            ? "Zobrazit přihlášené · správce"
            : "Zobrazit přihlášené · člen",
        buildAttendeesView({
            event: card,
            list,
            filter: { kind: "all" },
            page: 1,
            leadership,
            registrationOpen: false,
            names,
            reminderAvailable: false,
            webUrl: leadership ? "https://logi.example/cs/x" : null,
            copy,
        }).view
    )
}

function boardGroups() {
    return [
        { id: "inf", name: "Pěchota" },
        { id: "tank", name: "Tanky" },
        { id: "recon", name: "Recon" },
    ]
}
