/**
 * The board's example match (board L1: "VLK vs ROG", Přátelák, Sunday 11. 10.
 * at 20:00) as a sync payload, shared by the announcement tests and the dump
 * script.
 */

import type {
    DiscordConfig,
    EventRecord,
    Group,
    Roster,
    SyncPayload,
} from "../types"

export const BOARD_NOW = new Date("2026-10-05T16:02:00.000Z")

export const boardConfig: DiscordConfig = {
    id: "config-1",
    guildId: "111111111111111111",
    timezone: "Europe/Prague",
    defaultLanguage: "cs",
    calendarCategories: [],
    clanRoleId: "222222222222222222",
    announcementsChannelId: "333333333333333333",
    meetingChannelId: "444444444444444444",
    updatedAt: "2026-10-05T16:00:00.000Z",
}

export const boardGroups: Group[] = [
    {
        id: "inf",
        guildId: "111111111111111111",
        name: "Pěchota",
        color: "#3ba55c",
        updatedAt: "x",
    },
    {
        id: "tank",
        guildId: "111111111111111111",
        name: "Tanky",
        color: "#5865f2",
        discordRoleId: "555555555555555555",
        updatedAt: "x",
    },
    {
        id: "recon",
        guildId: "111111111111111111",
        name: "Recon",
        color: "#f0b232",
        updatedAt: "x",
    },
]

const participant = (
    userId: string,
    group: string | null,
    updatedAt = "2026-10-05T16:04:00.000Z",
    status: "attending" | "not_attending" = "attending"
) => ({ userId, status, group, updatedAt })

export function boardEvent(patch: Partial<EventRecord> = {}): EventRecord {
    return {
        id: "event-1",
        guildId: "111111111111111111",
        kind: "match",
        matchType: "friendly",
        name: "VLK vs ROG",
        map: "foy_warfare_day",
        side: "Allies",
        notes: "Tanky drží střed, F2 brání. Mikrofon povinný.",
        server: "VLK Scrim",
        serverPassword: "k7-sraz",
        requiredRoleIds: [],
        rewardRoleIds: [],
        signupGroupIds: ["inf", "tank", "recon"],
        registrationEnd: "2026-10-10T17:30:00.000Z",
        meetingStart: "2026-10-11T17:30:00.000Z",
        gameStart: "2026-10-11T18:00:00.000Z",
        gameEnd: "2026-10-11T20:00:00.000Z",
        pingClan: true,
        pingMode: "clan",
        createForumChannel: true,
        status: "registration",
        statusUpdatedAt: "2026-10-05T16:02:00.000Z",
        attendanceReminderLog: [],
        signUps: [],
        participants: [
            ...Array.from({ length: 12 }, (_, i) =>
                participant(`inf-${i + 1}`, "Pěchota")
            ),
            ...Array.from({ length: 4 }, (_, i) =>
                participant(`tank-${i + 1}`, "Tanky")
            ),
            participant("recon-1", "Recon"),
        ],
        matchTeams: [
            {
                teamId: "t-vlk",
                slot: "a",
                side: "Allies",
                snapshot: {
                    name: "Vlci",
                    shortCode: "VLK",
                    logoAssetId: null,
                    logoUrl: null,
                    teamRevision: 1,
                    capturedAt: "x",
                },
            },
            {
                teamId: "t-rog",
                slot: "b",
                side: "Axis",
                snapshot: {
                    name: "Rogues",
                    shortCode: "ROG",
                    logoAssetId: null,
                    logoUrl: null,
                    teamRevision: 1,
                    capturedAt: "x",
                },
            },
        ],
        updatedAt: "2026-10-05T16:02:00.000Z",
        ...patch,
        ...(patch.participants ? { participants: patch.participants } : {}),
    } as EventRecord & {
        signupGroupLimits: Array<{ groupId: string; max: number }>
    }
}

export function withLimits(event: EventRecord) {
    return Object.assign(event, {
        signupGroupLimits: [
            { groupId: "tank", max: 6 },
            { groupId: "recon", max: 2 },
        ],
    })
}

export const boardRoster: Roster = {
    id: "roster-1",
    eventId: "event-1",
    published: true,
    reservePlayerIds: ["r1", "r2", "r3", "r4", "r5", "r6", "r7"],
    updatedAt: "2026-10-11T13:10:00.000Z",
    squads: [
        {
            name: "F1",
            group: "Infantry",
            color: "#000",
            order: 0,
            players: [
                ...Array.from({ length: 17 }, (_, i) => ({
                    id: `p${i + 1}`,
                    ack: i < 15,
                })),
                { customName: "Host", ack: false },
            ],
        },
    ],
}

export function boardPayload(
    event: EventRecord,
    rosters: Roster[] = []
): SyncPayload {
    return {
        guild: {
            id: "guild-1",
            discordId: "111111111111111111",
            name: "Vlci",
            avatar: "",
            eventCategories: [
                { id: "friendly", label: "Přátelák", color: "#3ba55c" },
            ],
            calendarItems: [],
            botInside: true,
            adminIds: [],
            memberIds: [],
            mercenaryIds: [],
            updatedAt: "x",
        },
        config: boardConfig,
        groups: boardGroups,
        userDisplayNames: {},
        events: [event],
        calendarItems: [],
        rosters,
        topicPresets: [],
        syncStates: [],
        assignments: [],
    }
}
