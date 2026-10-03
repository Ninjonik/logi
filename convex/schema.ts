import {
    gameDataError,
    gameDataObservation,
    gameDataHistoryProgress,
    gameDataSession,
} from "./gameDataValidators"
import { resultPublicPayload, resultRevision } from "./resultValidators"
import { defineSchema, defineTable } from "convex/server"
import { apiKeyReadAccess } from "./apiKeyValidators"
import { v } from "convex/values"

const users = defineTable({
    sessionVersion: v.optional(v.number()),
    discordId: v.optional(v.string()),
    id: v.optional(v.string()),
    name: v.string(),
    note: v.optional(v.string()),
    nicknames: v.optional(v.record(v.string(), v.string())),
    platformIds: v.optional(v.array(v.string())),
    avatar: v.string(),
    managedGuildIds: v.array(v.string()),
    guildId: v.optional(v.string()),
    // The workspace opened from the dashboard landing page. Unlike guildId,
    // this may be an administrator-selected workspace.
    defaultWorkspaceId: v.optional(v.string()),
    // Convex record ID for the same workspace, used to open the dashboard
    // without resolving the Discord ID again.
    defaultWorkspaceRecordId: v.optional(v.string()),
    mercenaryGuildIds: v.array(v.string()),
    isStreamer: v.boolean(),
    // Global, default-on preference for Discord match-performance recaps.
    matchRecapNotificationsEnabled: v.optional(v.boolean()),
    score: v.optional(v.number()),
    scores: v.optional(v.record(v.string(), v.number())),
    performance: v.optional(
        v.object({
            matchesPlayed: v.number(),
            averages: v.object({
                kills: v.number(),
                killDeathRatio: v.number(),
                deaths: v.number(),
                offense: v.number(),
                defense: v.number(),
                support: v.number(),
            }),
        })
    ),
    onboarding: v.optional(
        v.object({
            dashboardSetupCompletedAt: v.optional(v.string()),
            workspaceTourCompletedAt: v.optional(
                v.record(v.string(), v.string())
            ),
        })
    ),
    createdAt: v.string(),
    updatedAt: v.string(),
})
    .index("discordId", ["discordId"])
    .index("id", ["id"])
    .searchIndex("name", { searchField: "name" })

const guildMember = v.object({
    id: v.string(),
    group: v.optional(v.string()),
    primaryGroup: v.optional(v.string()),
    secondaryGroups: v.optional(v.array(v.string())),
    status: v.optional(
        v.union(
            v.literal("pending"),
            v.literal("recruit"),
            v.literal("member"),
            v.literal("reserve_member"),
            v.literal("mercenary")
        )
    ),
    joinedAt: v.optional(v.string()),
})

const topic = v.object({
    id: v.optional(v.string()),
    title: v.string(),
    messages: v.optional(
        v.array(
            v.object({
                id: v.string(),
                body: v.optional(v.string()),
                attachments: v.array(v.string()),
            })
        )
    ),
    // Legacy single-message topic fields. New writes use messages instead.
    body: v.optional(v.string()),
    attachments: v.array(v.string()),
})

const squadRole = v.object({
    name: v.string(),
    color: v.string(),
    icon: v.string(),
    count: v.number(),
    note: v.optional(v.string()),
})

const squadPresetSquad = v.object({
    name: v.string(),
    group: v.string(),
    order: v.number(),
    color: v.string(),
    icon: v.string(),
    roles: v.array(squadRole),
})

const signUp = v.object({
    userId: v.string(),
    group: v.optional(v.union(v.string(), v.null())),
})

const signupActivity = v.object({
    guildId: v.string(),
    eventId: v.id("events"),
    eventName: v.string(),
    eventKind: v.union(v.literal("match"), v.literal("training")),
    userId: v.string(),
    action: v.union(
        v.literal("signed_up"),
        v.literal("changed_role"),
        v.literal("unsigned"),
        v.literal("declined")
    ),
    role: v.optional(v.union(v.string(), v.null())),
    previousRole: v.optional(v.union(v.string(), v.null())),
    occurredAt: v.string(),
})

const eventParticipant = v.object({
    userId: v.string(),
    status: v.union(v.literal("attending"), v.literal("not_attending")),
    group: v.optional(v.union(v.string(), v.null())),
    completed: v.optional(v.union(v.literal("passed"), v.literal("failed"))),
    updatedAt: v.string(),
})

const rosterScoreSettings = v.object({
    noCategory: v.number(),
    declined: v.number(),
    rosterPresent: v.number(),
    reservePresent: v.number(),
    rosterAbsent: v.number(),
    reserveAbsent: v.number(),
    excusedAbsence: v.number(),
})

const attendanceReminder = v.object({
    userId: v.string(),
    offsetHours: v.number(),
    sentAt: v.string(),
})

const ticketModalQuestion = v.object({
    id: v.string(),
    label: v.string(),
    placeholder: v.optional(v.string()),
    style: v.union(v.literal("short"), v.literal("paragraph")),
    required: v.boolean(),
})

const ticketCategory = v.object({
    id: v.string(),
    emoji: v.optional(v.string()),
    label: v.optional(v.string()),
    description: v.optional(v.string()),
    supportRoleIds: v.array(v.string()),
    modalQuestions: v.array(ticketModalQuestion),
})

const membershipCategory = v.object({
    id: v.string(),
    emoji: v.optional(v.string()),
    label: v.optional(v.string()),
    description: v.optional(v.string()),
    supportRoleIds: v.array(v.string()),
    recruitRoleIds: v.array(v.string()),
    finalRoleIds: v.array(v.string()),
    modalQuestions: v.array(ticketModalQuestion),
    assignmentType: v.union(
        v.literal("member"),
        v.literal("reserve_member"),
        v.literal("mercenary")
    ),
})

const eventCategory = v.object({
    id: v.string(),
    label: v.string(),
    color: v.string(),
    emoji: v.optional(v.string()),
})

const calendarItemRecurrence = v.object({
    frequency: v.union(
        v.literal("weekly"),
        v.literal("monthly_date"),
        v.literal("monthly_nth_weekday"),
        v.literal("yearly")
    ),
    interval: v.number(),
    until: v.optional(v.string()),
})

const calendarItem = v.object({
    guildId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    color: v.string(),
    emoji: v.optional(v.string()),
    label: v.optional(v.string()),
    startAt: v.string(),
    endAt: v.string(),
    allDay: v.boolean(),
    recurrence: v.optional(calendarItemRecurrence),
    createdAt: v.string(),
    updatedAt: v.string(),
})

const ticketSettings = v.object({
    enabled: v.boolean(),
    submitChannelId: v.optional(v.string()),
    ticketParentChannelId: v.optional(v.string()),
    panelTitle: v.string(),
    panelDescription: v.string(),
    panelImageUrl: v.optional(v.string()),
    categories: v.array(ticketCategory),
})

const membershipSettings = v.object({
    enabled: v.boolean(),
    submitChannelId: v.optional(v.string()),
    applicationParentChannelId: v.optional(v.string()),
    panelTitle: v.string(),
    panelDescription: v.string(),
    panelImageUrl: v.optional(v.string()),
    applicationWelcomeMessage: v.optional(v.string()),
    autoAssignRecruitOnApply: v.boolean(),
    inviteSupportMembersIndividually: v.optional(v.boolean()),
    rosterScoreSettings: v.optional(rosterScoreSettings),
    categories: v.array(membershipCategory),
})

const playerStatsServer = v.object({
    token: v.string(),
    url: v.string(),
})

// Optional everywhere so existing Hell Let Loose data remains valid.
const gameId = v.union(
    v.literal("hell_let_loose"),
    v.literal("hell_let_loose_vietnam"),
    v.literal("wardogs")
)

const gameDiscordOverrides = v.object({
    announcementsChannelId: v.optional(v.string()),
    eventInfoChannelId: v.optional(v.string()),
    forumCategoryId: v.optional(v.string()),
    meetingChannelId: v.optional(v.string()),
    squadVoiceCategoryId: v.optional(v.string()),
    playerStatsServers: v.optional(v.array(playerStatsServer)),
    membershipSettings: v.optional(membershipSettings),
    membershipPanelMessageId: v.optional(v.string()),
    membershipPanelLastConfigUpdatedAt: v.optional(v.string()),
})

// Convex records require a free-form string key validator.  These are known,
// stable games, so model the overrides as explicit optional fields instead.
const gameOverrides = v.object({
    hell_let_loose: v.optional(gameDiscordOverrides),
    hell_let_loose_vietnam: v.optional(gameDiscordOverrides),
    wardogs: v.optional(gameDiscordOverrides),
})

const eventResult = v.object({
    sourceUrl: v.string(),
    mapId: v.string(),
    mapName: v.optional(v.string()),
    endedAt: v.optional(v.string()),
    importedAt: v.string(),
    sideA: v.string(),
    sideB: v.string(),
    outcome: v.union(
        v.literal("victory"),
        v.literal("defeat"),
        v.literal("draw")
    ),
    score: v.object({
        sideA: v.number(),
        sideB: v.number(),
    }),
})

const statBreakdown = v.record(v.string(), v.number())

const matchPlayerTeam = v.object({
    side: v.string(),
    confidence: v.optional(v.union(v.literal("strong"), v.literal("mixed"))),
    ratio: v.optional(v.number()),
})

const matchPlayerSteamInfo = v.object({
    id: v.number(),
    created: v.string(),
    updated: v.union(v.string(), v.null()),
    profile: v.union(v.string(), v.null()),
    country: v.union(v.string(), v.null()),
    bans: v.union(v.number(), v.null()),
    has_bans: v.boolean(),
})

const matchPlayerUnit = v.object({
    ts: v.number(),
    team: v.number(),
    squad: v.number(),
    role: v.number(),
})

const matchPlayerEncounter = v.object({
    action: v.string(),
    player_id: v.string(),
    player_name: v.string(),
    ts: v.number(),
    weapon: v.string(),
})

const matchPlayerStat = v.object({
    id: v.number(),
    player_id: v.string(),
    player: v.string(),
    map_id: v.number(),
    kills: v.number(),
    kills_by_type: v.optional(statBreakdown),
    kills_streak: v.number(),
    deaths: v.number(),
    deaths_by_type: v.optional(statBreakdown),
    deaths_without_kill_streak: v.number(),
    teamkills: v.number(),
    teamkills_streak: v.number(),
    deaths_by_tk: v.number(),
    deaths_by_tk_streak: v.number(),
    nb_vote_started: v.number(),
    nb_voted_yes: v.number(),
    nb_voted_no: v.number(),
    time_seconds: v.number(),
    kills_per_minute: v.number(),
    deaths_per_minute: v.number(),
    kill_death_ratio: v.number(),
    longest_life_secs: v.number(),
    shortest_life_secs: v.number(),
    combat: v.number(),
    offense: v.number(),
    defense: v.number(),
    support: v.number(),
    most_killed: v.record(v.string(), v.number()),
    death_by: v.record(v.string(), v.number()),
    weapons: v.record(v.string(), v.number()),
    death_by_weapons: v.record(v.string(), v.number()),
    team: matchPlayerTeam,
    level: v.number(),
    platform: v.optional(v.string()),
    steaminfo: v.optional(matchPlayerSteamInfo),
    vehicle_kills: v.optional(v.number()),
    vehicles_destroyed: v.optional(v.number()),
    kills_and_assists: v.optional(v.number()),
    deaths_and_redeploys: v.optional(v.number()),
    units: v.optional(v.array(matchPlayerUnit)),
    encounters: v.optional(v.array(matchPlayerEncounter)),
})

const rawMatch = v.object({
    id: v.number(),
    creation_time: v.string(),
    start: v.string(),
    end: v.string(),
    server_number: v.number(),
    map_name: v.string(),
    result: v.object({
        axis: v.number(),
        allied: v.number(),
    }),
    game_layout: v.object({
        requested: v.array(v.union(v.number(), v.null())),
        set: v.array(v.string()),
    }),
    cap_flips: v.optional(
        v.array(
            v.object({
                allied_score: v.number(),
                axis_score: v.number(),
                ts: v.number(),
            })
        )
    ),
    match_time: v.optional(v.number()),
    player_stats: v.array(matchPlayerStat),
    map: v.object({
        id: v.string(),
        game_mode: v.string(),
        attackers: v.optional(v.union(v.string(), v.null())),
        environment: v.string(),
        pretty_name: v.string(),
        image_name: v.string(),
        map: v.object({
            id: v.string(),
            name: v.string(),
            tag: v.string(),
            pretty_name: v.string(),
            shortname: v.string(),
            allies: v.object({
                name: v.string(),
                team: v.string(),
            }),
            axis: v.object({
                name: v.string(),
                team: v.string(),
            }),
            orientation: v.string(),
        }),
    }),
})

const rosterPlayer = v.object({
    id: v.optional(v.string()),
    customName: v.optional(v.string()),
    ack: v.boolean(),
    confirmed: v.optional(v.boolean()),
    note: v.optional(v.string()),
    roleName: v.optional(v.string()),
    roleIcon: v.optional(v.string()),
})

const reserveAttendance = v.object({
    userId: v.string(),
    ack: v.boolean(),
    confirmed: v.optional(v.boolean()),
})

const eventNotice = v.object({
    userId: v.string(),
    reason: v.string(),
    createdAt: v.string(),
})

const rosterSquad = v.object({
    name: v.string(),
    group: v.string(),
    order: v.number(),
    color: v.string(),
    icon: v.optional(v.string()),
    players: v.array(rosterPlayer),
})

const userAssignments = defineTable({
    userId: v.string(),
    serverId: v.string(),
    gameId: v.optional(gameId),
    type: v.union(
        v.literal("member"),
        v.literal("reserve_member"),
        v.literal("mercenary")
    ),
    status: v.union(
        v.literal("pending"),
        v.literal("recruit"),
        v.literal("active")
    ),
    membershipCategoryId: v.optional(v.string()),
    primaryGroupId: v.optional(v.id("groups")),
    secondaryGroupIds: v.optional(v.array(v.id("groups"))),
    group: v.optional(v.string()),
    paused: v.boolean(),
    pausedNote: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
})
    .index("serverId", ["serverId"])
    .index("userId", ["userId"])
    .index("serverId_gameId", ["serverId", "gameId"])
    .index("serverId_userId_gameId", ["serverId", "userId", "gameId"])
    .index("serverId_userId", ["serverId", "userId"])

const guildGames = defineTable({
    guildId: v.string(),
    // The application registry validates supported games before persistence.
    // Keep this a string while legacy and current game identifiers coexist.
    gameId: v.string(),
    enabled: v.boolean(),
    settingsVersion: v.number(),
    createdAt: v.string(),
    updatedAt: v.string(),
}).index("guildId_gameId", ["guildId", "gameId"])

export default defineSchema({
    peopleIntegrationState: defineTable({
        key: v.literal("global"),
        generation: v.string(),
        reconciliationRun: v.optional(v.string()),
        reconciliationCursor: v.optional(v.union(v.string(), v.null())),
        reconciliationLeaseUntil: v.optional(v.number()),
    }).index("key", ["key"]),
    peopleResultLinks: defineTable({
        eventId: v.id("events"),
        sessionId: v.id("gameSessions"),
        sourceDigest: v.string(),
        resultVersion: v.number(),
    })
        .index("eventId", ["eventId"])
        .index("sessionId", ["sessionId"]),
    eventResultRevisions: defineTable({
        eventId: v.id("events"),
        guildId: v.string(),
        gameId: v.string(),
        version: v.number(),
        revision: resultRevision,
    }).index("eventId_version", ["eventId", "version"]),
    platformLinkChallenges: defineTable({
        tokenHash: v.string(),
        sessionHash: v.string(),
        discordUserId: v.string(),
        userRecordId: v.id("users"),
        returnOrigin: v.string(),
        locale: v.union(v.literal("en"), v.literal("cs"), v.literal("de")),
        createdAt: v.number(),
        expiresAt: v.number(),
        status: v.union(
            v.literal("pending"),
            v.literal("verifying"),
            v.literal("consumed"),
            v.literal("failed"),
            v.literal("cancelled")
        ),
    })
        .index("tokenHash", ["tokenHash"])
        .index("userRecordId_createdAt", ["userRecordId", "createdAt"]),
    platformIdentityLinks: defineTable({
        platform: v.literal("steam"),
        platformId: v.string(),
        userRecordId: v.id("users"),
        discordUserId: v.string(),
        logiUserId: v.string(),
        method: v.literal("steam_openid"),
        verifiedAt: v.number(),
        revokedAt: v.union(v.number(), v.null()),
        active: v.boolean(),
    })
        .index("platform_platformId_active", [
            "platform",
            "platformId",
            "active",
        ])
        .index("userRecordId_verifiedAt", ["userRecordId", "verifiedAt"]),
    platformLinkNonces: defineTable({
        nonceHash: v.string(),
        expiresAt: v.number(),
    })
        .index("nonceHash", ["nonceHash"])
        .index("expiresAt", ["expiresAt"]),
    users,
    guildGames,
    dashboardSessions: defineTable({
        sid: v.string(),
        subject: v.string(),
        userRecordId: v.id("users"),
        userSessionVersion: v.number(),
        createdAt: v.number(),
        expiresAt: v.number(),
        revokedAt: v.optional(v.number()),
    })
        .index("sid", ["sid"])
        .index("expiresAt", ["expiresAt"]),
    ssoApplications: defineTable({
        guildId: v.string(),
        clientId: v.string(),
        clientSecretHash: v.string(),
        name: v.string(),
        websiteUrl: v.string(),
        redirectUris: v.array(v.string()),
        backchannelLogoutUri: v.optional(v.string()),
        createdAt: v.string(),
        updatedAt: v.string(),
    })
        .index("clientId", ["clientId"])
        .index("guildId", ["guildId"]),
    ssoAuthorizationCodes: defineTable({
        applicationRecordId: v.optional(v.id("ssoApplications")),
        clientSecretHash: v.optional(v.string()),
        userRecordId: v.optional(v.id("users")),
        sessionId: v.optional(v.string()),
        nonce: v.optional(v.string()),
        scope: v.optional(v.string()),
        codeHash: v.string(),
        clientId: v.string(),
        redirectUri: v.string(),
        userId: v.string(),
        codeChallenge: v.string(),
        codeChallengeMethod: v.string(),
        expiresAt: v.number(),
        usedAt: v.optional(v.number()),
    })
        .index("codeHash", ["codeHash"])
        .index("expiresAt", ["expiresAt"]),
    ssoAccessTokens: defineTable({
        applicationRecordId: v.optional(v.id("ssoApplications")),
        clientSecretHash: v.optional(v.string()),
        userRecordId: v.optional(v.id("users")),
        sessionId: v.optional(v.string()),
        scope: v.optional(v.string()),
        tokenHash: v.string(),
        clientId: v.string(),
        userId: v.string(),
        expiresAt: v.number(),
        revokedAt: v.optional(v.number()),
    })
        .index("tokenHash", ["tokenHash"])
        .index("expiresAt", ["expiresAt"]),
    guilds: defineTable({
        discordId: v.optional(v.string()),
        id: v.optional(v.string()),
        name: v.string(),
        avatar: v.string(),
        description: v.optional(v.string()),
        eventCategories: v.optional(v.array(eventCategory)),
        enabledGames: v.optional(v.array(gameId)),
        botInside: v.boolean(),
        adminIds: v.array(v.string()),
        // Legacy role-derived dashboard admins. New authorization uses the current
        // Discord member access record and adminAccessOverrides instead.
        dashboardAdminIds: v.optional(v.array(v.string())),
        // A manual setting controls the dashboard role and its derived access.
        // Discord Administrator remains an unconditional bootstrap path.
        adminAccessOverrides: v.optional(v.record(v.string(), v.boolean())),
        memberIds: v.array(v.string()),
        members: v.array(guildMember),
        mercenaryIds: v.array(v.string()),
        createdAt: v.string(),
        updatedAt: v.string(),
    })
        .index("discordId", ["discordId"])
        .index("id", ["id"])
        .searchIndex("name", { searchField: "name" }),
    discordConfigs: defineTable({
        guildId: v.string(),
        timezone: v.string(),
        defaultLanguage: v.union(
            v.literal("en"),
            v.literal("cs"),
            v.literal("de")
        ),
        announcementsChannelId: v.optional(v.string()),
        eventInfoChannelId: v.optional(v.string()),
        errorsChannelId: v.optional(v.string()),
        calendarChannelId: v.optional(v.string()),
        // A random, per-clan capability token used only by the public iCalendar
        // subscription endpoint. It is intentionally separate from Discord
        // settings and can be rotated without affecting the bot.
        calendarFeedToken: v.optional(v.string()),
        calendarCategories: v.optional(v.array(v.string())),
        calendarMessageChannelId: v.optional(v.string()),
        calendarMessageId: v.optional(v.string()),
        calendarMessageLastConfigUpdatedAt: v.optional(v.string()),
        forumCategoryId: v.optional(v.string()),
        meetingChannelId: v.optional(v.string()),
        squadVoiceCategoryId: v.optional(v.string()),
        clanRoleId: v.optional(v.string()),
        dashboardAdminRoleId: v.optional(v.string()),
        playerStatsServers: v.optional(v.array(playerStatsServer)),
        gameOverrides: v.optional(gameOverrides),
        ticketSettings: v.optional(ticketSettings),
        membershipSettings: v.optional(membershipSettings),
        ticketPanelMessageId: v.optional(v.string()),
        ticketPanelLastConfigUpdatedAt: v.optional(v.string()),
        membershipPanelMessageId: v.optional(v.string()),
        membershipPanelLastConfigUpdatedAt: v.optional(v.string()),
        ticketCounter: v.optional(v.number()),
        membershipApplicationCounter: v.optional(v.number()),
        createdAt: v.string(),
        updatedAt: v.string(),
    }).index("guildId", ["guildId"]),
    platformSettings: defineTable({
        workspaceGuildId: v.string(),
        statusChannelId: v.optional(v.string()),
        statusMessageId: v.optional(v.string()),
        statusUpdatesThreadId: v.optional(v.string()),
        serviceStates: v.optional(
            v.array(v.object({ name: v.string(), online: v.boolean() }))
        ),
        updatedAt: v.string(),
    }).index("workspaceGuildId", ["workspaceGuildId"]),
    calendarItems: defineTable(calendarItem).index("guildId", ["guildId"]),
    groups: defineTable({
        guildId: v.string(),
        // Missing values are legacy Hell Let Loose groups.
        gameId: v.optional(gameId),
        name: v.string(),
        color: v.string(),
        order: v.number(),
        parentId: v.optional(v.id("groups")),
        description: v.optional(v.string()),
        discordRoleId: v.optional(v.string()),
        discordEmoji: v.optional(v.string()),
        createdAt: v.string(),
        updatedAt: v.string(),
    })
        .index("guildId", ["guildId"])
        .index("guildId_gameId", ["guildId", "gameId"])
        .index("guildId_name", ["guildId", "name"]),
    events: defineTable({
        guildId: v.string(),
        gameId: v.optional(gameId),
        kind: v.optional(v.union(v.literal("match"), v.literal("training"))),
        matchType: v.optional(v.string()),
        name: v.string(),
        description: v.optional(v.string()),
        thumbnailUrl: v.optional(v.string()),
        imageUrl: v.optional(v.string()),
        // Copied from the clan defaults when an event is created.  Keeping these
        // on the event prevents later setting changes from moving existing bot messages.
        announcementChannelId: v.optional(v.string()),
        eventInfoChannelId: v.optional(v.string()),
        meetingChannelId: v.optional(v.string()),
        createSquadVoiceChannels: v.optional(v.boolean()),
        squadVoiceCategoryId: v.optional(v.string()),
        durationMinutes: v.optional(v.number()),
        requiredRoleIds: v.optional(v.array(v.string())),
        rewardRoleIds: v.optional(v.array(v.string())),
        signupGroupIds: v.optional(v.array(v.string())),
        allowedSignupStatuses: v.optional(
            v.array(
                v.union(
                    v.literal("recruit"),
                    v.literal("member"),
                    v.literal("reserve_member"),
                    v.literal("mercenary")
                )
            )
        ),
        useGeneralSignup: v.optional(v.boolean()),
        signupReminderStatuses: v.optional(
            v.array(
                v.union(
                    v.literal("recruit"),
                    v.literal("member"),
                    v.literal("reserve_member")
                )
            )
        ),
        recurrence: v.optional(
            v.object({
                frequency: v.union(
                    v.literal("weekly"),
                    v.literal("monthly_date"),
                    v.literal("monthly_nth_weekday")
                ),
                interval: v.number(),
                weekdays: v.array(v.number()),
                monthDay: v.optional(v.number()),
                nth: v.optional(v.number()),
                weekday: v.optional(v.number()),
            })
        ),
        attendeeRoleId: v.optional(v.string()),
        reserveRoleId: v.optional(v.string()),
        server: v.optional(v.string()),
        serverPassword: v.optional(v.string()),
        side: v.optional(v.string()),
        map: v.optional(v.string()),
        cap: v.optional(v.string()),
        notes: v.optional(v.string()),
        // Missing means announce registration immediately, preserving legacy events.
        registrationStart: v.optional(v.string()),
        registrationEnd: v.string(),
        meetingStart: v.string(),
        gameStart: v.string(),
        gameEnd: v.string(),
        pingClan: v.boolean(),
        pingMode: v.optional(
            v.union(v.literal("none"), v.literal("clan"), v.literal("roles"))
        ),
        pingRoleIds: v.optional(v.array(v.string())),
        createForumChannel: v.optional(v.boolean()),
        topicPresetId: v.optional(v.id("topicPresets")),
        stratmapIds: v.optional(v.array(v.id("stratmaps"))),
        status: v.optional(
            v.union(
                v.literal("registration"),
                v.literal("closed"),
                v.literal("starting"),
                v.literal("concluded")
            )
        ),
        statusUpdatedAt: v.optional(v.string()),
        concludedAt: v.optional(v.string()),
        eventResult: v.optional(eventResult),
        reviewedResult: v.optional(resultPublicPayload),
        reviewedResultGameId: v.optional(v.string()),
        matchStatsId: v.optional(v.id("matchStats")),
        competitionFixtureId: v.optional(v.id("competitionFixtures")),
        attendanceReminderLog: v.optional(v.array(attendanceReminder)),
        participants: v.optional(v.array(eventParticipant)),
        signUps: v.optional(v.array(signUp)),
        scoreAppliedAt: v.optional(v.string()),
        scoreResolution: v.optional(
            v.union(v.literal("applied"), v.literal("skipped"))
        ),
        absenceNotices: v.optional(v.array(eventNotice)),
        createdAt: v.string(),
        updatedAt: v.optional(v.string()),
    }).index("guildId", ["guildId"]),
    signupActivities: defineTable(signupActivity)
        .index("eventId_occurredAt", ["eventId", "occurredAt"])
        .index("guildId_occurredAt", ["guildId", "occurredAt"]),
    competitions: defineTable({
        // Optional so existing ECL records remain valid; missing values are
        // treated as the legacy Hell Let Loose scope.
        gameId: v.optional(gameId),
        slug: v.string(),
        name: v.string(),
        season: v.string(),
        description: v.optional(v.string()),
        format: v.object({
            kind: v.literal("league_with_playoffs"),
            standings: v.literal("ecl_cap_score"),
        }),
        createdAt: v.string(),
        updatedAt: v.string(),
    }).index("slug", ["slug"]),
    competitionDivisions: defineTable({
        competitionId: v.id("competitions"),
        name: v.string(),
        order: v.number(),
        createdAt: v.string(),
    }).index("competitionId", ["competitionId"]),
    competitionTeams: defineTable({
        competitionId: v.id("competitions"),
        guildId: v.id("guilds"),
        divisionId: v.optional(v.id("competitionDivisions")),
        withdrawn: v.boolean(),
        createdAt: v.string(),
        updatedAt: v.string(),
    })
        .index("competitionId", ["competitionId"])
        .index("guildId", ["guildId"])
        .index("competitionId_guildId", ["competitionId", "guildId"]),
    competitionFixtures: defineTable({
        competitionId: v.id("competitions"),
        divisionId: v.optional(v.id("competitionDivisions")),
        phase: v.union(
            v.literal("league"),
            v.literal("playoff"),
            v.literal("relegation")
        ),
        teamAId: v.id("guilds"),
        teamBId: v.id("guilds"),
        scheduledAt: v.optional(v.string()),
        scoreA: v.optional(v.number()),
        scoreB: v.optional(v.number()),
        status: v.union(
            v.literal("scheduled"),
            v.literal("final"),
            v.literal("forfeit")
        ),
        eventId: v.optional(v.id("events")),
        createdAt: v.string(),
        updatedAt: v.string(),
    })
        .index("competitionId", ["competitionId"])
        .index("eventId", ["eventId"]),
    eventScheduleJobs: defineTable({
        eventId: v.id("events"),
        kind: v.union(
            v.literal("registration-start"),
            v.literal("close-registration"),
            v.literal("start-event"),
            v.literal("create-squad-voice-channels"),
            v.literal("conclude-event"),
            v.literal("attendance-reminder"),
            v.literal("signup-reminder")
        ),
        dueAt: v.string(),
        status: v.union(v.literal("pending"), v.literal("processing")),
        attempts: v.number(),
        claimedAt: v.optional(v.string()),
        createdAt: v.string(),
        updatedAt: v.string(),
    })
        .index("eventId", ["eventId"])
        .index("status_dueAt", ["status", "dueAt"])
        .index("status", ["status"]),
    stratmaps: defineTable({
        guildId: v.string(),
        gameId: v.optional(gameId),
        eventId: v.optional(v.id("events")),
        title: v.string(),
        description: v.optional(v.string()),
        baseMapId: v.string(),
        side: v.optional(v.string()),
        strongpointId: v.optional(v.string()),
        state: v.string(),
        createdBy: v.string(),
        createdAt: v.string(),
        updatedAt: v.string(),
    })
        .index("guildId", ["guildId"])
        .index("eventId", ["eventId"]),
    topicPresets: defineTable({
        guildId: v.string(),
        name: v.string(),
        side: v.optional(v.string()),
        map: v.optional(v.string()),
        cap: v.optional(v.string()),
        notes: v.optional(v.string()),
        topics: v.array(topic),
        createdAt: v.string(),
        updatedAt: v.string(),
    }).index("guildId", ["guildId"]),
    squadPresets: defineTable({
        guildId: v.string(),
        // Missing values are legacy Hell Let Loose presets.
        gameId: v.optional(gameId),
        name: v.string(),
        squads: v.array(squadPresetSquad),
        createdAt: v.string(),
        updatedAt: v.string(),
    }).index("guildId", ["guildId"]),
    rosters: defineTable({
        // Optional while legacy rosters are backfilled from their parent event.
        guildId: v.optional(v.string()),
        // Missing values are legacy Hell Let Loose rosters.
        gameId: v.optional(gameId),
        eventId: v.id("events"),
        squadPresetId: v.optional(v.id("squadPresets")),
        squads: v.array(rosterSquad),
        reservePlayerIds: v.array(v.string()),
        reserveAttendances: v.optional(v.array(reserveAttendance)),
        notAttendingPlayerIds: v.array(v.string()),
        streamerId: v.optional(v.string()),
        published: v.boolean(),
        createdAt: v.string(),
        updatedAt: v.string(),
    })
        .index("eventId", ["eventId"])
        .index("guildId_updatedAt", ["guildId", "updatedAt"]),
    clanApiUserProjections: defineTable({
        guildId: v.string(),
        userId: v.string(),
        updatedAt: v.string(),
    })
        .index("guildId_userId", ["guildId", "userId"])
        .index("guildId_updatedAt", ["guildId", "updatedAt"]),
    matchRecaps: defineTable({
        eventId: v.id("events"),
        userId: v.string(),
        // New deliveries bind the data identity separately from the Discord recipient.
        userRecordId: v.optional(v.id("users")),
        discordUserId: v.optional(v.string()),
        status: v.union(v.literal("pending"), v.literal("sent")),
        previousTen: v.optional(
            v.object({
                matches: v.number(),
                kills: v.number(),
                deaths: v.number(),
                kd: v.number(),
            })
        ),
        createdAt: v.string(),
        sentAt: v.optional(v.string()),
    })
        .index("eventId", ["eventId"])
        .index("eventId_userId", ["eventId", "userId"]),
    discordEventSyncs: defineTable({
        eventId: v.id("events"),
        guildId: v.string(),
        announcementChannelId: v.optional(v.string()),
        announcementMessageId: v.optional(v.string()),
        rosterUpdateChannelId: v.optional(v.string()),
        rosterUpdateMessageId: v.optional(v.string()),
        eventInfoMessageId: v.optional(v.string()),
        eventInfoMessageRenderVersion: v.optional(v.string()),
        scheduledEventId: v.optional(v.string()),
        scheduledEventStatus: v.optional(
            v.union(
                v.literal("scheduled"),
                v.literal("active"),
                v.literal("completed"),
                v.literal("canceled")
            )
        ),
        forumChannelId: v.optional(v.string()),
        forumThreadId: v.optional(v.string()),
        infoMessageId: v.optional(v.string()),
        topicMessageIds: v.array(v.string()),
        topicMessageState: v.optional(
            v.array(
                v.object({
                    topicId: v.string(),
                    threadId: v.string(),
                    messageIds: v.array(v.string()),
                })
            )
        ),
        lastSyncedAt: v.optional(v.string()),
        lastEventUpdatedAt: v.optional(v.string()),
        lastRosterUpdatedAt: v.optional(v.string()),
        lastConfigUpdatedAt: v.optional(v.string()),
        lastCalendarSyncVersion: v.optional(v.string()),
        squadVoiceChannelIds: v.optional(v.array(v.string())),
        createdAt: v.string(),
        updatedAt: v.string(),
    })
        .index("eventId", ["eventId"])
        .index("guildId", ["guildId"]),
    discordMemberAccess: defineTable({
        guildId: v.string(),
        userId: v.string(),
        roleIds: v.array(v.string()),
        voiceChannelId: v.optional(v.string()),
        isAdmin: v.boolean(),
        hasDashboardAccess: v.boolean(),
        createdAt: v.string(),
        updatedAt: v.string(),
    })
        .index("guildId", ["guildId"])
        .index("userId", ["userId"])
        .index("guildId_userId", ["guildId", "userId"]),
    meetingAttendanceRequests: defineTable({
        guildId: v.string(),
        rosterId: v.id("rosters"),
        meetingChannelId: v.string(),
        status: v.union(
            v.literal("pending"),
            v.literal("processing"),
            v.literal("completed"),
            v.literal("failed")
        ),
        requestedAt: v.string(),
        expiresAt: v.string(),
        claimedAt: v.optional(v.string()),
        completedAt: v.optional(v.string()),
        error: v.optional(v.string()),
        result: v.optional(
            v.object({
                matchedVoiceCount: v.number(),
                rosteredCount: v.number(),
                reserveCount: v.number(),
                updatedCount: v.number(),
                updatedUserIds: v.array(v.string()),
            })
        ),
    })
        .index("status", ["status"])
        .index("guildId", ["guildId"]),
    ticketThreads: defineTable({
        guildId: v.string(),
        threadId: v.string(),
        parentChannelId: v.string(),
        creatorId: v.string(),
        categoryId: v.string(),
        categoryLabel: v.string(),
        ticketNumber: v.number(),
        status: v.union(v.literal("open"), v.literal("closed")),
        transcriptMessageId: v.optional(v.string()),
        answers: v.array(
            v.object({
                questionId: v.string(),
                label: v.string(),
                value: v.string(),
            })
        ),
        openedAt: v.string(),
        closedAt: v.optional(v.string()),
        closedByUserId: v.optional(v.string()),
        closeReason: v.optional(v.string()),
        createdAt: v.string(),
        updatedAt: v.string(),
    })
        .index("guildId", ["guildId"])
        .index("threadId", ["threadId"])
        .index("guildId_ticketNumber", ["guildId", "ticketNumber"]),
    membershipApplicationThreads: defineTable({
        guildId: v.string(),
        // Missing values are legacy Hell Let Loose applications.
        gameId: v.optional(gameId),
        threadId: v.string(),
        parentChannelId: v.string(),
        creatorId: v.string(),
        categoryId: v.string(),
        categoryLabel: v.string(),
        assignmentType: v.union(
            v.literal("member"),
            v.literal("reserve_member"),
            v.literal("mercenary")
        ),
        applicationNumber: v.number(),
        assignmentId: v.optional(v.id("userAssignments")),
        transcriptMessageId: v.optional(v.string()),
        answers: v.array(
            v.object({
                questionId: v.string(),
                label: v.string(),
                value: v.string(),
            })
        ),
        status: v.union(v.literal("open"), v.literal("closed")),
        openedAt: v.string(),
        closedAt: v.optional(v.string()),
        closedByUserId: v.optional(v.string()),
        closeReason: v.optional(v.string()),
        closeOutcome: v.optional(
            v.union(
                v.literal("denied"),
                v.literal("pending"),
                v.literal("recruit"),
                v.literal("member"),
                v.literal("reserve_member"),
                v.literal("mercenary")
            )
        ),
        createdAt: v.string(),
        updatedAt: v.string(),
    })
        .index("guildId", ["guildId"])
        .index("threadId", ["threadId"])
        .index("guildId_applicationNumber", ["guildId", "applicationNumber"]),
    platformIdLinkTokens: defineTable({
        token: v.string(),
        guildId: v.string(),
        userId: v.string(),
        userName: v.string(),
        userAvatar: v.optional(v.string()),
        categoryId: v.optional(v.string()),
        language: v.union(v.literal("en"), v.literal("cs")),
        completionMode: v.optional(
            v.union(v.literal("membership"), v.literal("link"))
        ),
        applyMessageUrl: v.optional(v.string()),
        interactionToken: v.optional(v.string()),
        interactionApplicationId: v.optional(v.string()),
        expiresAt: v.string(),
        consumedAt: v.optional(v.string()),
        createdAt: v.string(),
        updatedAt: v.string(),
    })
        .index("token", ["token"])
        .index("userId", ["userId"]),
    privacyRequests: defineTable({
        userId: v.string(),
        discordId: v.string(),
        userName: v.string(),
        type: v.union(v.literal("export"), v.literal("erasure")),
        status: v.union(
            v.literal("requested"),
            v.literal("completed"),
            v.literal("rejected")
        ),
        requestedAt: v.string(),
        completedAt: v.optional(v.string()),
        note: v.optional(v.string()),
    })
        .index("userId", ["userId"])
        .index("status_requestedAt", ["status", "requestedAt"]),
    userAssignments,
    playerStats: defineTable({
        id: v.string(),
        userId: v.optional(v.string()),
        latestName: v.optional(v.string()),
        updatedAt: v.string(),
        matches: v.record(
            v.string(),
            v.object({
                sourceUrl: v.string(),
                importedAt: v.string(),
                endedAt: v.optional(v.string()),
                mapId: v.string(),
                mapName: v.optional(v.string()),
                playerName: v.string(),
                userId: v.optional(v.string()),
                team: v.string(),
                kills: v.number(),
                killDeathRatio: v.number(),
                deaths: v.number(),
                offense: v.number(),
                defense: v.number(),
                support: v.number(),
            })
        ),
    })
        .index("id", ["id"])
        .index("userId", ["userId"]),
    // Materialized, bounded read models for the dashboard.  Keeping only ten
    // snapshots makes the analytics pages cheap even for long-running clans.
    guildPerformanceHistory: defineTable({
        guildId: v.string(),
        matches: v.array(
            v.object({
                eventId: v.string(),
                // Missing values belong to legacy Hell Let Loose records.
                gameId: v.optional(gameId),
                playedAt: v.string(),
                label: v.string(),
                combat: v.number(),
                offense: v.optional(v.number()),
                support: v.number(),
                kills: v.number(),
                deaths: v.number(),
                points: v.optional(v.number()),
                kd: v.optional(v.number()),
            })
        ),
        updatedAt: v.string(),
    }).index("guildId", ["guildId"]),
    playerPerformanceHistory: defineTable({
        guildId: v.string(),
        userId: v.string(),
        matches: v.array(
            v.object({
                eventId: v.string(),
                // Missing values belong to legacy Hell Let Loose records.
                gameId: v.optional(gameId),
                playedAt: v.string(),
                label: v.string(),
                combat: v.number(),
                offense: v.optional(v.number()),
                support: v.number(),
                kills: v.number(),
                deaths: v.number(),
                points: v.optional(v.number()),
                kd: v.optional(v.number()),
            })
        ),
        updatedAt: v.string(),
    })
        .index("guildId", ["guildId"])
        .index("guildId_userId", ["guildId", "userId"]),
    matchStats: defineTable({
        guildId: v.string(),
        gameId: v.optional(gameId),
        eventId: v.id("events"),
        sourceUrl: v.string(),
        matchId: v.string(),
        importedAt: v.string(),
        raw: rawMatch,
        createdAt: v.string(),
        updatedAt: v.string(),
    })
        .index("guildId", ["guildId"])
        .index("eventId", ["eventId"]),
    gameDataConnections: defineTable({
        sourceRef: v.string(),
        guildId: v.string(),
        gameId: v.union(v.literal("hell_let_loose"), v.literal("wardogs")),
        pollAfterMs: v.number(),
        provider: v.union(
            v.literal("hll_crcon"),
            v.literal("wardogs_rcon"),
            v.literal("wardogs_warcon"),
            v.literal("wardogs_public_directory")
        ),
        providerServerId: v.string(),
        sourceFingerprint: v.string(),
        enabled: v.boolean(),
        generation: v.number(),
        fence: v.number(),
        leaseUntil: v.number(),
        attempt: v.number(),
        nextAttemptAt: v.union(v.number(), v.null()),
        lastAttemptAt: v.union(v.string(), v.null()),
        errorCategory: v.union(gameDataError, v.null()),
        observation: v.union(gameDataObservation, v.null()),
        etag: v.union(v.string(), v.null()),
        createdAt: v.string(),
        updatedAt: v.string(),
        historyCount: v.optional(v.number()),
        historyLastSuccessAt: v.optional(v.string()),
        historyErrorCategory: v.optional(v.union(gameDataError, v.null())),
        warconReadWindowAt: v.optional(v.number()),
        warconReadCount: v.optional(v.number()),
        warconReadBlockedUntil: v.optional(v.number()),
    })
        .index("guildId", ["guildId"])
        .index("sourceRef", ["sourceRef"])
        .index("nextAttemptAt", ["nextAttemptAt"]),
    leagueMatchCache: defineTable({
        matchId: v.string(),
        snapshotJson: v.optional(v.string()),
        lastAttemptAt: v.optional(v.number()),
        nextRefreshAt: v.number(),
        error: v.optional(v.string()),
        leaseUntil: v.number(),
        fence: v.number(),
        accessedAt: v.number(),
    })
        .index("matchId", ["matchId"])
        .index("accessedAt", ["accessedAt"]),
    leagueFetchBudget: defineTable({
        key: v.literal("public-matches"),
        windowAt: v.number(),
        count: v.number(),
        blockedUntil: v.number(),
        cachedEntries: v.number(),
    }).index("key", ["key"]),
    warconReadCache: defineTable({
        connectionId: v.id("gameDataConnections"),
        queryJson: v.string(),
        generation: v.number(),
        fence: v.number(),
        leaseUntil: v.number(),
        cacheUntil: v.number(),
        retryUntil: v.optional(v.number()),
        retainUntil: v.number(),
        envelopeJson: v.optional(v.string()),
    })
        .index("connection_query", ["connectionId", "queryJson"])
        .index("connectionId", ["connectionId"]),
    gameDataHistoryRuns: defineTable({
        connectionId: v.id("gameDataConnections"),
        progress: gameDataHistoryProgress,
        fence: v.number(),
        leaseUntil: v.number(),
        attempt: v.number(),
        nextAttemptAt: v.union(v.number(), v.null()),
        errorCategory: v.union(gameDataError, v.null()),
        lastSuccessAt: v.union(v.string(), v.null()),
        lastCompletedAt: v.union(v.string(), v.null()),
        lastWasRevisit: v.boolean(),
    })
        .index("connectionId", ["connectionId"])
        .index("nextAttemptAt", ["nextAttemptAt"]),
    gameSessions: defineTable({
        connectionId: v.id("gameDataConnections"),
        guildId: v.string(),
        gameId: v.union(v.literal("hell_let_loose"), v.literal("wardogs")),
        externalId: v.string(),
        session: gameDataSession,
        complete: v.boolean(),
        fetchedAt: v.number(),
        // Older rows must be recollected before they prove the current source configuration.
        sourceGeneration: v.optional(v.number()),
        updatedAt: v.string(),
    })
        .index("connection_external", ["connectionId", "externalId"])
        .index("guildId_gameId", ["guildId", "gameId"])
        .index("guildId_gameId_fetchedAt", ["guildId", "gameId", "fetchedAt"])
        .index("connection_complete_fetched", [
            "connectionId",
            "complete",
            "fetchedAt",
        ]),
    apiKeys: defineTable({
        guildId: v.string(),
        name: v.string(),
        keyHash: v.string(),
        keyPrefix: v.string(),
        createdAt: v.string(),
        lastUsedAt: v.optional(v.string()),
        revokedAt: v.optional(v.string()),
        readAccess: v.optional(apiKeyReadAccess),
        writeAccess: v.optional(
            v.object({
                resources: v.array(v.literal("event-commands")),
                gameIds: v.array(
                    v.union(v.literal("hell_let_loose"), v.literal("wardogs"))
                ),
            })
        ),
    })
        .index("guildId", ["guildId"])
        .index("keyHash", ["keyHash"]),
    websiteEventPolicies: defineTable({
        applicationRecordId: v.id("ssoApplications"),
        apiKeyId: v.id("apiKeys"),
        guildId: v.string(),
        enabled: v.boolean(),
        games: v.array(
            v.object({
                gameId: v.union(
                    v.literal("hell_let_loose"),
                    v.literal("wardogs")
                ),
                roleIds: v.array(v.string()),
            })
        ),
        version: v.string(),
        updatedAt: v.string(),
        updatedBy: v.string(),
    })
        .index("applicationRecordId", ["applicationRecordId"])
        .index("apiKeyId", ["apiKeyId"])
        .index("guildId", ["guildId"]),
    websiteEventCommandReceipts: defineTable({
        applicationRecordId: v.id("ssoApplications"),
        apiKeyId: v.id("apiKeys"),
        clientId: v.string(),
        guildId: v.string(),
        subject: v.string(),
        gameId: v.union(v.literal("hell_let_loose"), v.literal("wardogs")),
        idempotencyKey: v.string(),
        bodyHash: v.string(),
        operation: v.union(
            v.literal("create"),
            v.literal("update"),
            v.literal("cancel")
        ),
        eventId: v.id("events"),
        revision: v.string(),
        createdAt: v.string(),
    })
        .index("application_subject_game_key", [
            "applicationRecordId",
            "subject",
            "gameId",
            "idempotencyKey",
        ])
        .index("guildId", ["guildId"]),
    apiRateLimitBuckets: defineTable({
        bucket: v.string(),
        resetAt: v.number(),
        count: v.number(),
    }).index("bucket", ["bucket"]),
    apiIdempotencyKeys: defineTable({
        guildId: v.string(),
        key: v.string(),
        methodPath: v.string(),
        bodyHash: v.string(),
        status: v.number(),
        responseBody: v.string(),
        expiresAt: v.number(),
        createdAt: v.string(),
    })
        .index("guildId_key", ["guildId", "key"])
        .index("expiresAt", ["expiresAt"]),
    membershipIntegrationPolicies: defineTable({
        apiKeyId: v.id("apiKeys"),
        guildId: v.string(),
        enabled: v.boolean(),
        version: v.string(),
        games: v.array(
            v.object({ gameId: v.string(), roleIds: v.array(v.string()) })
        ),
        updatedAt: v.string(),
    })
        .index("apiKeyId", ["apiKeyId"])
        .index("guildId", ["guildId"]),
    membershipGuilds: defineTable({
        guildId: v.string(),
        epoch: v.string(),
        revision: v.string(),
        epochRevision: v.string(),
        refreshWindowAt: v.number(),
        refreshCount: v.number(),
    }).index("guildId", ["guildId"]),
    memberObservations: defineTable({
        guildId: v.string(),
        discordUserId: v.string(),
        state: v.union(
            v.literal("present"),
            v.literal("left"),
            v.literal("unknown")
        ),
        roleIds: v.array(v.string()),
        observedAt: v.union(v.string(), v.null()),
        receivedAt: v.string(),
        epoch: v.string(),
        revision: v.string(),
        unavailable: v.boolean(),
        refreshFence: v.number(),
        refreshUntil: v.number(),
        nextRefreshAt: v.number(),
        seenRunId: v.optional(v.id("membershipSyncRuns")),
        // Survives rejoin so queued side effects cannot cross a departure.
        departureRevision: v.optional(v.string()),
    })
        .index("guildId", ["guildId"])
        .index("guildId_discordUserId", ["guildId", "discordUserId"]),
    memberRoleOperations: defineTable({
        guildId: v.string(),
        gameId,
        // Assignment identifier and explicit, enqueue-time Discord link are distinct.
        userId: v.string(),
        userRecordId: v.optional(v.id("users")),
        discordUserId: v.optional(v.string()),
        version: v.number(),
        actorId: v.string(),
        actorKind: v.union(
            v.literal("dashboard"),
            v.literal("recruitment"),
            v.literal("application"),
            v.literal("rollback")
        ),
        categoryId: v.optional(v.string()),
        assignmentFingerprint: v.string(),
        policyFingerprint: v.string(),
        allowedRoleIds: v.array(v.string()),
        desiredRoleIds: v.array(v.string()),
        departureRevision: v.string(),
        status: v.union(
            v.literal("pending"),
            v.literal("running"),
            v.literal("retry_scheduled"),
            v.literal("applied"),
            v.literal("denied"),
            v.literal("superseded"),
            v.literal("failed")
        ),
        attempts: v.number(),
        failureCount: v.number(),
        nextAttemptAt: v.number(),
        leaseUntil: v.number(),
        fence: v.number(),
        reason: v.string(),
        createdAt: v.string(),
        updatedAt: v.string(),
    })
        .index("guildId_nextAttemptAt", ["guildId", "nextAttemptAt"])
        .index("guildId_gameId_userId_version", [
            "guildId",
            "gameId",
            "userId",
            "version",
        ])
        .index("guildId_gameId_discordUserId_version", [
            "guildId",
            "gameId",
            "discordUserId",
            "version",
        ])
        .index("guildId_createdAt", ["guildId", "createdAt"]),
    memberRoleLocks: defineTable({
        guildId: v.string(),
        discordUserId: v.string(),
        leaseUntil: v.number(),
        fence: v.number(),
    }).index("guildId_discordUserId", ["guildId", "discordUserId"]),
    memberRoleAudits: defineTable({
        operationId: v.id("memberRoleOperations"),
        guildId: v.string(),
        userId: v.string(),
        actorId: v.string(),
        fence: v.number(),
        attempt: v.number(),
        outcome: v.string(),
        reason: v.string(),
        at: v.string(),
    })
        .index("operationId_fence", ["operationId", "fence"])
        .index("guildId_at", ["guildId", "at"]),
    membershipSyncRuns: defineTable({
        guildId: v.string(),
        epoch: v.string(),
        startedRevision: v.string(),
        observedAt: v.string(),
        expectedCount: v.optional(v.number()),
        seenCount: v.number(),
        nextBatch: v.number(),
        status: v.union(
            v.literal("collecting"),
            v.literal("sweeping"),
            v.literal("cache-sweeping"),
            v.literal("complete"),
            v.literal("superseded")
        ),
        cursor: v.union(v.string(), v.null()),
        expiresAt: v.number(),
    })
        .index("guildId", ["guildId"])
        .index("expiresAt", ["expiresAt"]),
    membershipSyncSubjects: defineTable({
        runId: v.id("membershipSyncRuns"),
        discordUserId: v.string(),
    })
        .index("runId_discordUserId", ["runId", "discordUserId"])
        .index("runId", ["runId"]),
    membershipRefreshLimits: defineTable({
        name: v.string(),
        until: v.number(),
    }).index("name", ["name"]),
    integrationHeads: defineTable({
        guildId: v.string(),
        revision: v.string(),
        floor: v.string(),
    }).index("guildId", ["guildId"]),
    integrationChanges: defineTable({
        guildId: v.string(),
        gameId: v.string(),
        resource: v.string(),
        id: v.string(),
        revision: v.string(),
        revisionOrder: v.string(),
        operation: v.union(v.literal("upsert"), v.literal("remove")),
        expiresAt: v.number(),
    })
        .index("guildId_revisionOrder", ["guildId", "revisionOrder"])
        .index("expiresAt", ["expiresAt"]),
    integrationRecords: defineTable({
        guildId: v.string(),
        gameId: v.string(),
        resource: v.string(),
        id: v.string(),
        revision: v.string(),
        operation: v.union(v.literal("upsert"), v.literal("remove")),
        expiresAt: v.optional(v.number()),
    })
        .index("identity", ["guildId", "gameId", "resource", "id"])
        .index("expiresAt", ["expiresAt"]),
    webhookSubscriptions: defineTable({
        guildId: v.string(),
        url: v.string(),
        eventTypes: v.array(v.string()),
        secret: v.string(),
        enabled: v.boolean(),
        createdAt: v.string(),
        updatedAt: v.string(),
        lastDeliveredAt: v.optional(v.string()),
        lastFailureAt: v.optional(v.string()),
    }).index("guildId", ["guildId"]),
    webhookDeliveries: defineTable({
        webhookId: v.id("webhookSubscriptions"),
        guildId: v.string(),
        eventType: v.string(),
        payload: v.string(),
        attempt: v.number(),
        status: v.union(
            v.literal("pending"),
            v.literal("processing"),
            v.literal("delivered"),
            v.literal("failed")
        ),
        processingStartedAt: v.optional(v.number()),
        fence: v.optional(v.number()),
        nextAttemptAt: v.number(),
        responseStatus: v.optional(v.number()),
        lastError: v.optional(v.string()),
        createdAt: v.string(),
        deliveredAt: v.optional(v.string()),
    })
        .index("guildId", ["guildId"])
        .index("webhookId", ["webhookId"])
        .index("status_nextAttemptAt", ["status", "nextAttemptAt"])
        .index("guildId_status_nextAttemptAt", [
            "guildId",
            "status",
            "nextAttemptAt",
        ])
        .index("status_processingStartedAt", ["status", "processingStartedAt"]),
    webhookDispatchGuilds: defineTable({
        guildId: v.string(),
        wakeAt: v.number(),
    })
        .index("guildId", ["guildId"])
        .index("wakeAt", ["wakeAt"]),
    webhookDispatchState: defineTable({
        name: v.string(),
        cursor: v.union(v.string(), v.null()),
        migrated: v.boolean(),
        fence: v.number(),
        leaseUntil: v.number(),
    }).index("name", ["name"]),
    articles: defineTable({
        guildId: v.string(),
        title: v.string(),
        description: v.string(),
        tags: v.array(v.string()),
        body: v.string(),
        attachments: v.array(v.string()),
        authorId: v.string(),
        createdAt: v.string(),
        updatedAt: v.string(),
    }).index("guildId", ["guildId"]),
    publicPreviews: defineTable({
        entityType: v.union(
            v.literal("player"),
            v.literal("clan"),
            v.literal("match")
        ),
        entityId: v.string(),
        title: v.string(),
        description: v.string(),
        imageVersion: v.string(),
        updatedAt: v.string(),
        expiresAt: v.string(),
    })
        .index("entity", ["entityType", "entityId"])
        .index("expiresAt", ["expiresAt"]),
})
