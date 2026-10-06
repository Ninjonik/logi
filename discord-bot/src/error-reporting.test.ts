import {
    MessageFlags,
    PermissionFlagsBits,
    type MessageCreateOptions,
} from "discord.js"
import assert from "node:assert/strict"
import test from "node:test"

import {
    actionChannelId,
    buildErrorReport,
    discordFailureOf,
    errorReportLinks,
    inferErrorSource,
    missingPermissions,
    type ErrorReportContext,
} from "./error-reporting"

const SITE = "https://logi.example"
const ANNOUNCEMENTS = "100000000000000001"
const TICKETS = "100000000000000002"
const ROLE = "300000000000000003"

const context = (
    overrides: Partial<ErrorReportContext> = {}
): ErrorReportContext => ({
    errorsChannelId: "100000000000000009",
    language: "cs",
    timeZone: "Europe/Prague",
    messageStyle: null,
    serverId: "k17server",
    channels: {
        announcements: ANNOUNCEMENTS,
        ticketThreads: TICKETS,
        forumCategory: "100000000000000004",
    },
    event: {
        id: "k17event",
        kind: "match",
        title: "VLK vs ROG",
        category: "Přátelák",
        gameStart: "2026-10-11T18:00:00.000Z",
        announcementChannelId: null,
        meetingChannelId: null,
    },
    ...overrides,
})

/** A channel whose bot permissions are everything except `denied`. */
const channel = (id: string, name: string, denied: bigint[] = []) => ({
    id,
    name,
    permissionsFor: () => ({
        has: (flag: bigint) => !denied.includes(flag),
    }),
})

function discord(input: {
    channels?: ReturnType<typeof channel>[]
    roles?: Record<string, { position: number }>
    botTop?: number
    serverDenied?: bigint[]
}) {
    const me = {
        roles: { highest: { position: input.botTop ?? 10 } },
        permissions: {
            has: (flag: bigint) => !(input.serverDenied ?? []).includes(flag),
        },
    }
    const guild = {
        roles: {
            cache: new Map(Object.entries(input.roles ?? {})),
        },
        members: { fetch: async () => new Map() },
    }
    return {
        guild: guild as never,
        me: me as never,
        channel: async (id: string | undefined) =>
            ((input.channels ?? []).find((item) => item.id === id) ??
                null) as never,
    }
}

type Json = Record<string, unknown> & { components?: Json[] }
const cardOf = (message: MessageCreateOptions | null) => {
    assert.ok(message)
    assert.equal(message.flags, MessageFlags.IsComponentsV2)
    assert.deepEqual(message.allowedMentions, { parse: [] })
    const container = JSON.parse(
        JSON.stringify(
            (message.components as Array<{ toJSON(): unknown }>)[0]!.toJSON()
        )
    ) as Json & { accent_color: number }
    const flat: Json[] = []
    const walk = (node: Json) => {
        flat.push(node)
        for (const child of node.components ?? []) walk(child)
    }
    walk(container)
    return {
        accent: container.accent_color,
        text: flat
            .map((node) =>
                typeof node.content === "string" ? node.content : ""
            )
            .join("\n"),
        buttons: flat
            .filter((node) => node.type === 2)
            .map((node) => ({ label: node.label, url: node.url })),
    }
}

test("older call sites are recognised by their scope and action (L5-17..25)", () => {
    const cases: Array<
        [Parameters<typeof inferErrorSource>[0], string | null]
    > = [
        [{ scope: "event-sync", action: 'Sync event "x"' }, "announcement"],
        [{ scope: "event-roles" }, "eventRoles"],
        [
            { scope: "forum", action: 'Create a forum channel for "x"' },
            "forumCreate",
        ],
        [
            { scope: "forum", action: 'Update the forum channel for "x"' },
            "forumUpdate",
        ],
        [
            { scope: "forum", action: 'Grant forum access for "x"' },
            "forumAccess",
        ],
        [
            { scope: "forum", action: 'Create the forum info post for "x"' },
            "forumCreate",
        ],
        [
            { scope: "forum", action: 'Update the forum info post for "x"' },
            "forumUpdate",
        ],
        [
            {
                scope: "scheduled-events",
                action: 'Create the scheduled event for "x"',
            },
            "scheduledEventCreate",
        ],
        [
            {
                scope: "scheduled-events",
                action: 'Update the scheduled event for "x"',
            },
            "scheduledEventUpdate",
        ],
        [
            {
                scope: "scheduled-events",
                action: 'Change scheduled event status for "x"',
            },
            "scheduledEventUpdate",
        ],
        [
            { scope: "scheduled-events", action: "Cancel a scheduled event" },
            "scheduledEventCancel",
        ],
        [
            { scope: "guild-sync", action: "managed member roles" },
            "memberRoles",
        ],
        [
            { scope: "guild-sync", action: "dashboard admin role sync" },
            "adminAccess",
        ],
        [{ scope: "guild-sync", action: "member access sync" }, "adminAccess"],
        [{ scope: "guild-sync", action: "ticket panel sync" }, "ticketPanel"],
        [
            { scope: "guild-sync", action: "membership panel sync" },
            "applicationPanel",
        ],
        [
            { scope: "guild-sync", action: "calendar panel sync" },
            "calendarPanel",
        ],
        [
            { scope: "guild-sync", action: "attendance reminder sync" },
            "attendanceReminders",
        ],
        [
            {
                scope: "interaction",
                location: "Ticket system",
                action: "Create a ticket thread",
            },
            "ticketOpen",
        ],
        [
            {
                scope: "interaction",
                location: "Ticket system",
                action: "Add a participant to a ticket thread",
            },
            "ticketSupport",
        ],
        [
            {
                scope: "interaction",
                location: "Ticket system",
                action: "Send the first ticket message",
            },
            "ticketIntro",
        ],
        [
            {
                scope: "interaction",
                location: "Ticket system",
                action: "Rename a ticket thread",
            },
            "ticketRename",
        ],
        [
            {
                scope: "interaction",
                location: "Membership applications",
                action: "Create a membership application thread",
            },
            "applicationOpen",
        ],
        [
            {
                scope: "interaction",
                location: "Membership applications",
                action: "Add a participant to a membership application thread",
            },
            "applicationRecruiters",
        ],
        [
            {
                scope: "interaction",
                location: "Membership applications",
                action: "Send the first membership application message",
            },
            "applicationIntro",
        ],
        [
            {
                scope: "interaction",
                location: "Membership applications",
                action: "Rename a membership application thread",
            },
            "applicationRename",
        ],
        [
            {
                scope: "interaction",
                location: "Player reports",
                action: "Create a report thread",
            },
            "playerReport",
        ],
        [
            {
                scope: "interaction",
                location: "Membership and account linking",
                action: "Send a platform link DM",
            },
            null,
        ],
        [
            {
                scope: "interaction",
                location: "Thread cleanup",
                action: "Delete a thread",
            },
            "general",
        ],
    ]
    for (const [input, expected] of cases)
        assert.equal(inferErrorSource(input), expected, JSON.stringify(input))
})

test("the missing permission is worked out from the bot's real permissions (L5-08..11, L5-26)", async () => {
    const message = await buildErrorReport(
        {
            guildId: "1",
            error: Object.assign(new Error("Missing Permissions"), {
                code: 50013,
                status: 403,
            }),
            action: 'Sync event "VLK vs ROG"',
            location: "Event sync",
            scope: "event-sync",
            target: "VLK vs ROG",
            details: { eventId: "k17event", status: "registration" },
        },
        context(),
        discord({
            channels: [
                channel(ANNOUNCEMENTS, "oznameni", [
                    PermissionFlagsBits.EmbedLinks,
                ]),
            ],
        }),
        SITE
    )
    const card = cardOf(message)
    assert.equal(card.accent, 0x80848e)
    assert.match(
        card.text,
        /-# \*\*CHYBA BOTA · ZÁPAS\*\*\n### Ohlášení zápasu se neodeslalo\nVLK vs ROG · Přátelák · ne <t:\d+:d> · <t:\d+:t>\n🟡 \*\*Zkusí se znovu po opravě\*\*/
    )
    assert.match(
        card.text,
        /Bot nemá v kanálu <#100000000000000001> oprávnění Vkládat odkazy\./
    )
    assert.match(
        card.text,
        /V Discordu otevři <#100000000000000001> → Upravit kanál → Oprávnění → Logi a povol Vkládat odkazy\. Ohlášení se pošle samo při další synchronizaci, do 5 minut\./
    )
    assert.deepEqual(card.buttons, [
        {
            label: "Otevřít zápas",
            url: "https://logi.example/cs/dashboard/servers/k17server/matches/k17event",
        },
        {
            label: "Kanály v Logi",
            url: "https://logi.example/cs/dashboard/servers/k17server/settings/channels",
        },
    ])
    // Never the raw answer, the internal scope or a record ID (L5-16, L5-B04).
    assert.doesNotMatch(
        card.text,
        /Missing Permissions|event-sync|k17event|50013|Scope/
    )
})

test("a role above the bot and a private-thread ticket read as on the board (L5-12, L5-14)", async () => {
    const roles = cardOf(
        await buildErrorReport(
            {
                guildId: "1",
                error: { code: 50013 },
                source: "memberRoles",
                roleId: ROLE,
                memberIds: [],
            },
            context({ event: null }),
            discord({ roles: { [ROLE]: { position: 12 } }, botTop: 10 }),
            SITE
        )
    )
    assert.match(roles.text, /### Role se 1 členovi nepodařilo upravit/)
    assert.match(
        roles.text,
        /Role <@&300000000000000003> je v seznamu rolí výš než role Logi/
    )
    assert.deepEqual(
        roles.buttons.map((button) => button.label),
        ["Role a přístup v Logi"]
    )
    const ticket = cardOf(
        await buildErrorReport(
            {
                guildId: "1",
                error: { code: 50013 },
                action: "Create a ticket thread",
                location: "Ticket system",
                scope: "interaction",
                target: "Nahlásit hráče",
                details: { user: "hrac17", categoryId: "report" },
            },
            context({ event: null }),
            discord({
                channels: [
                    channel(TICKETS, "podpora", [
                        PermissionFlagsBits.CreatePrivateThreads,
                        PermissionFlagsBits.SendMessagesInThreads,
                    ]),
                ],
            }),
            SITE
        )
    )
    assert.match(
        ticket.text,
        /### Ticket se neotevřel\nKategorie Nahlásit hráče · zkoušel @hrac17\n⚪ \*\*Hráč dostal zprávu, ať to zkusí později\*\*/
    )
    assert.match(
        ticket.text,
        /Bot nemůže v kanálu <#100000000000000002> zakládat soukromá vlákna\./
    )
    assert.match(
        ticket.text,
        /Povol roli Logi v <#100000000000000002> oprávnění Vytvářet soukromá vlákna a Posílat zprávy ve vláknech\. Pak hráči napiš, ať ticket otevře znovu\./
    )
    assert.deepEqual(
        ticket.buttons.map((button) => button.label),
        ["Tickety v Logi"]
    )
})

test("server-level permissions, a deleted role and a timeout get their own sentences", async () => {
    const roles = cardOf(
        await buildErrorReport(
            { guildId: "1", error: { code: 50013 }, source: "eventRoles" },
            context(),
            discord({ serverDenied: [PermissionFlagsBits.ManageRoles] }),
            SITE
        )
    )
    assert.match(
        roles.text,
        /Role Logi nemá na serveru oprávnění Spravovat role\./
    )
    const deleted = cardOf(
        await buildErrorReport(
            {
                guildId: "1",
                error: { code: 50013 },
                source: "memberRoles",
                roleId: ROLE,
            },
            context({ event: null }),
            discord({}),
            SITE
        )
    )
    assert.match(deleted.text, /Role <@&300000000000000003> už neexistuje\./)
    const timeout = cardOf(
        await buildErrorReport(
            {
                guildId: "1",
                error: new Error(
                    "calendar panel sync for guild 1 timed out after 20000ms."
                ),
                scope: "guild-sync",
                action: "calendar panel sync",
                location: "Guild sync",
            },
            context({
                event: null,
                channels: { calendar: "100000000000000005" },
            }),
            discord({ channels: [channel("100000000000000005", "kalendar")] }),
            SITE
        )
    )
    assert.match(
        timeout.text,
        /### Kalendář se neaktualizoval\nKanál <#100000000000000005>\n🟡 \*\*Zkusí se znovu sám\*\*/
    )
    assert.deepEqual(timeout.buttons, [])
})

test("DM delivery failures never reach the errors channel (L2-63)", async () => {
    assert.equal(
        await buildErrorReport(
            {
                guildId: "1",
                error: { code: 50007 },
                action: "Send a platform link DM",
                location: "Membership and account linking",
                scope: "interaction",
            },
            context(),
            discord({}),
            SITE
        ),
        null
    )
})

test("helpers read Discord errors, channels and links safely", () => {
    assert.deepEqual(
        discordFailureOf({ rawError: { code: 50001 }, status: 403 }),
        {
            code: 50001,
            status: 403,
            name: undefined,
            message: undefined,
        }
    )
    assert.deepEqual(discordFailureOf("boom"), { message: "boom" })
    assert.equal(
        actionChannelId(
            "roster",
            {},
            { channels: { eventInfo: "100000000000000006" }, event: null }
        ),
        "100000000000000006"
    )
    assert.equal(
        actionChannelId(
            "calendarPanel",
            { channelId: "not-an-id" },
            { channels: {}, event: null }
        ),
        undefined
    )
    assert.deepEqual(
        missingPermissions(
            ["ViewChannel", "EmbedLinks"],
            (flag) => flag !== PermissionFlagsBits.EmbedLinks
        ),
        ["EmbedLinks"]
    )
    assert.deepEqual(
        errorReportLinks({ serverId: null, language: "cs", event: null }, SITE),
        {}
    )
    assert.equal(
        errorReportLinks(
            {
                serverId: "k17",
                language: "de",
                event: { ...context().event!, kind: "training" },
            },
            SITE
        ).match,
        "https://logi.example/de/dashboard/servers/k17/trainings/k17event"
    )
})
