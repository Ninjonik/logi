import type {
    AppUser,
    EventRecord,
    Guild,
    Roster,
    DiscordConfig,
    Group,
} from "@/types/domain"
import type { ServerUserAssignmentReadModel } from "@/lib/read-models/assignments"
import type { DiscordMetadata } from "@/hooks/use-discord-metadata"
import { examplePlayers, examplePerformance } from "./demo-data"

export const SAMPLE_ID = "onboarding-example"
export const sampleMetadata: DiscordMetadata = {
    roles: [
        { id: "sample-member", name: "NOVA" },
        { id: "sample-admin", name: "Clan admin" },
        { id: "sample-recruit", name: "Recruit" },
    ],
    channels: [
        { id: "sample-announcements", name: "announcements", type: 0 },
        { id: "sample-signups", name: "match-signups", type: 0 },
        { id: "sample-results", name: "results", type: 0 },
        { id: "sample-voice", name: "Meeting", type: 2 },
        { id: "sample-support", name: "support", type: 0 },
    ],
    emojis: [],
}
/** Rebuilt from one clock so examples remain upcoming and all pages agree. No persisted IDs. */
export function clanFixtures(now: Date) {
    const iso = (days: number, hours = 0) =>
        new Date(
            now.getTime() + days * 86400000 + hours * 3600000
        ).toISOString()
    const users: AppUser[] = examplePlayers.map((p, i) => ({
        id: `sample-player-${i}`,
        discordId: `sample-player-${i}`,
        hasDiscordLink: false,
        platformIds: [],
        name: p.name,
        nicknames: {},
        avatar: "",
        managedGuildIds: [],
        mercenaryGuildIds: [],
        isStreamer: false,
        scores: { [SAMPLE_ID]: 20 + i * 3 },
        createdAt: iso(-30),
        updatedAt: iso(-1),
    }))
    const guild: Guild = {
        id: SAMPLE_ID,
        discordId: SAMPLE_ID,
        name: "NOVA",
        avatar: "",
        description: "NOVA",
        enabledGames: ["wardogs", "hell_let_loose"],
        botInside: true,
        adminIds: [],
        memberIds: users.map((p) => p.discordId),
        members: users.map((p) => ({
            id: p.discordId,
            secondaryGroups: [],
            status: "member",
        })),
        mercenaryIds: [],
        workspaceMode: "full",
        createdAt: iso(-30),
        updatedAt: iso(-1),
    }
    const event = (
        id: string,
        days: number,
        kind: "match" | "training" = "match"
    ): EventRecord => ({
        id,
        guildId: SAMPLE_ID,
        gameId: "wardogs",
        kind,
        name: kind === "match" ? "NOVA vs WOLF vs RAVN" : "NOVA · Bakurani",
        map: "Bakurani",
        side: "Valkyra",
        requiredRoleIds: [],
        rewardRoleIds: [],
        registrationEnd: iso(days, -2),
        meetingStart: iso(days, -0.5),
        gameStart: iso(days),
        gameEnd: iso(days, 2),
        pingClan: false,
        createForumChannel: true,
        stratmapIds: [],
        status: days < 0 ? "concluded" : "registration",
        statusUpdatedAt: iso(-1),
        attendanceReminderLog: [],
        participants: users.map((p, i) => ({
            userId: p.discordId,
            status: "attending",
            group: i % 2 ? "Bravo" : "Alpha",
            updatedAt: iso(-1),
        })),
        signUps: users.map((p, i) => ({
            userId: p.discordId,
            group: i % 2 ? "Bravo" : "Alpha",
        })),
        absenceNotices: [],
        createdAt: iso(-7),
        updatedAt: iso(-1),
    })
    const groups: Group[] = ["Alpha", "Bravo"].map((name, i) => ({
        id: `sample-group-${i}`,
        guildId: SAMPLE_ID,
        gameId: "wardogs",
        name,
        color: i ? "#3b82f6" : "#f59e0b",
        order: i,
        createdAt: iso(-30),
        updatedAt: iso(-1),
    }))
    const assignments: ServerUserAssignmentReadModel[] = users.map((p, i) => ({
        id: `sample-assignment-${i}`,
        userId: p.discordId,
        serverId: SAMPLE_ID,
        gameId: "wardogs",
        type: "member",
        status: i === users.length - 1 ? "pending" : "active",
        primaryGroupId: groups[i % 2].id,
        secondaryGroupIds: [],
        paused: false,
        createdAt: iso(-30),
        updatedAt: iso(-1),
    }))
    const upcoming = event("sample-match", 3)
    const previous = event("sample-result", -3)
    previous.eventResult = {
        sourceUrl: "https://example.invalid/results/sample",
        mapId: "bakurani",
        mapName: "Bakurani",
        importedAt: iso(-2),
        endedAt: previous.gameEnd,
        sideA: "Valkyra",
        sideB: "Manticore",
        outcome: "victory",
        score: { sideA: 100, sideB: 72 },
    }
    const events = [upcoming, event("sample-training", 2, "training"), previous]
    const roster: Roster = {
        id: "sample-roster",
        eventId: upcoming.id,
        guildId: SAMPLE_ID,
        gameId: "wardogs",
        squads: ["Alpha", "Bravo"].map((name, i) => ({
            name,
            group: name,
            order: i,
            color: i ? "#3b82f6" : "#f59e0b",
            players: users
                .filter((_, n) => n % 2 === i)
                .map((p, n) => ({
                    id: p.discordId,
                    ack: n === 0,
                    confirmed: i === 0 && n === 0,
                    roleName: n === 0 ? "Squad leader" : "Rifleman",
                })),
        })),
        reservePlayerIds: [],
        notAttendingPlayerIds: [],
        published: true,
        createdAt: iso(-2),
        updatedAt: iso(-1),
    }
    const config: DiscordConfig = {
        id: SAMPLE_ID,
        calendarCategories: [],
        guildId: SAMPLE_ID,
        announcementsChannelId: "sample-announcements",
        eventInfoChannelId: "sample-signups",
        eventResultsChannelId: "sample-results",
        meetingChannelId: "sample-voice",
        clanRoleId: "sample-member",
        defaultLanguage: "en",
        timezone: "Europe/Prague",
        createdAt: iso(-30),
        updatedAt: iso(-1),
    }
    return {
        now,
        users,
        groups,
        assignments,
        guild,
        upcoming,
        previous,
        events,
        roster,
        config,
        performance: examplePerformance.map((p, i) => ({
            ...p,
            playedAt: iso(-i - 1),
        })),
    }
}
