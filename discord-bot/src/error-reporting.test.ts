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
    errorFacts,
    errorReportLinks,
    inferErrorSource,
    missingPermissions,
    type ErrorReportContext,
} from "./error-reporting"
import {
    PublicationChannelError,
    PublicationPermissionError,
} from "./sync/publication-errors"
import { PublicationNotSent } from "../../src/application/discord-publications/publish"
import { EventSyncStepError, eventSyncErrorSource } from "./sync/events"
import { roleFailureError } from "./sync/role-failure-reports"

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
        /-# \*\*CHYBA BOTA · ZÁPAS\*\*\n### Ohlášení zápasu se neodeslalo\n-# VLK vs ROG · Přátelák · ne <t:\d+:d> · <t:\d+:t>\n🟡 \*\*Zkusí se znovu po opravě\*\*/
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
        /### Ticket se neotevřel\n-# Kategorie Nahlásit hráče · zkoušel @hrac17\n⚪ \*\*Hráč dostal zprávu, ať to zkusí později\*\*/
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
        /### Kalendář se neaktualizoval\n-# Kanál <#100000000000000005>\n🟡 \*\*Zkusí se znovu sám\*\*/
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

const CALENDAR = "100000000000000005"
const PANELS = "100000000000000007"
const discordAnswer = (code: number, status = 403) =>
    Object.assign(new Error("Missing Permissions"), { code, status })

test("a publication failure is read through its wrapper: chip, why and what to do (L5-08..10, L5-22, L5-26, B02, B03)", async () => {
    // A create Discord refused: PublicationNotSent carries the 403 as cause.
    const created = cardOf(
        await buildErrorReport(
            {
                guildId: "1",
                error: Object.assign(
                    new PublicationNotSent(
                        "Discord rejected the create request."
                    ),
                    { cause: discordAnswer(50013) }
                ),
                source: "announcement",
                eventId: "k17event",
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
    )
    assert.match(created.text, /🟡 \*\*Zkusí se znovu po opravě\*\*/)
    assert.match(
        created.text,
        /Bot nemá v kanálu <#100000000000000001> oprávnění Vkládat odkazy\.\n\*\*Co udělat\*\*\nV Discordu otevři <#100000000000000001> → Upravit kanál → Oprávnění → Logi a povol Vkládat odkazy\. Ohlášení se pošle samo při další synchronizaci, do 5 minut\./
    )
    assert.doesNotMatch(created.text, /Discord akci odmítl|Zkusí se znovu sám/)

    // The channel pre-check names what is missing and the channel itself.
    const precheck = new PublicationPermissionError(
        ["SendMessages", "ReadMessageHistory"],
        "kalendar",
        CALENDAR
    )
    const calendar = cardOf(
        await buildErrorReport(
            {
                guildId: "1",
                error: Object.assign(
                    new PublicationNotSent("Channel unavailable before send."),
                    { cause: precheck, deliveryCause: precheck }
                ),
                source: "calendarPanel",
            },
            context({ event: null, channels: { calendar: CALENDAR } }),
            discord({ channels: [channel(CALENDAR, "kalendar")] }),
            SITE
        )
    )
    assert.match(
        calendar.text,
        /### Kalendář se neaktualizoval\n-# Kanál <#100000000000000005>\n🟡 \*\*Zkusí se znovu po opravě\*\*/
    )
    assert.match(
        calendar.text,
        /Bot nemá v kanálu <#100000000000000005> oprávnění Posílat zprávy a Číst historii zpráv\./
    )
    assert.match(
        calendar.text,
        /Logi a povol Posílat zprávy a Číst historii zpráv\. Panel se obnoví sám při další synchronizaci\./
    )

    // A deleted channel and a channel that is not a text channel.
    const gone = cardOf(
        await buildErrorReport(
            {
                guildId: "1",
                error: Object.assign(new PublicationNotSent("x"), {
                    cause: new PublicationChannelError("channel_missing"),
                }),
                source: "ticketPanel",
            },
            context({ event: null, channels: { ticketPanel: CALENDAR } }),
            discord({ channels: [channel(CALENDAR, "tickety")] }),
            SITE
        )
    )
    assert.match(gone.text, /🟡 \*\*Zkusí se znovu po opravě\*\*/)
    assert.match(
        gone.text,
        /Kanál z nastavení Logi už na serveru není\.\n\*\*Co udělat\*\*\nVyber nový kanál v Logi → Kanály a jazyk\./
    )
    const voice = cardOf(
        await buildErrorReport(
            {
                guildId: "1",
                error: new PublicationChannelError("channel_type"),
                source: "applicationPanel",
            },
            context({ event: null, channels: { applicationPanel: CALENDAR } }),
            discord({ channels: [channel(CALENDAR, "nabor")] }),
            SITE
        )
    )
    assert.match(
        voice.text,
        /Kanál <#100000000000000005> není textový kanál\.\n\*\*Co udělat\*\*\nVyber textový kanál v Logi → Kanály a jazyk\./
    )
    // A Discord outage stays a retry by itself.
    const outage = cardOf(
        await buildErrorReport(
            {
                guildId: "1",
                error: Object.assign(new PublicationNotSent("x"), {
                    cause: discordAnswer(0, 503),
                }),
                source: "calendarPanel",
            },
            context({ event: null }),
            discord({}),
            SITE
        )
    )
    assert.match(outage.text, /🟡 \*\*Zkusí se znovu sám\*\*/)
    assert.match(outage.text, /Discord neodpověděl včas\./)
})

test("errorFacts and discordFailureOf unwrap causes safely", () => {
    const cycle: { cause?: unknown; code?: number } = {}
    cycle.cause = cycle
    assert.deepEqual(errorFacts(cycle).facts, { failure: "other" })
    assert.equal(
        discordFailureOf(
            Object.assign(new Error("outer"), {
                cause: Object.assign(new Error("inner"), { code: 10003 }),
            })
        ).code,
        10003
    )
    assert.deepEqual(
        errorFacts(new PublicationPermissionError(["EmbedLinks"], "servery")),
        {
            facts: {
                failure: "missingPermission",
                missingPermissions: ["EmbedLinks"],
                channel: "#servery",
            },
            channelId: undefined,
        }
    )
    assert.deepEqual(errorFacts(new Error("x")).facts, { failure: "other" })
})

test("member and match role failures name the role and why (L5-14, L5-19, L5-21)", async () => {
    const report = {
        reasons: ["role_unmanageable_or_deleted"],
    }
    const above = cardOf(
        await buildErrorReport(
            {
                guildId: "1",
                error: roleFailureError(report),
                source: "memberRoles",
                roleId: ROLE,
                memberIds: [],
            },
            context({ event: null }),
            discord({ roles: { [ROLE]: { position: 12 } }, botTop: 10 }),
            SITE
        )
    )
    assert.match(
        above.text,
        /-# Role <@&300000000000000003>\n🟡 \*\*Zkusí se znovu po opravě\*\*/
    )
    assert.match(
        above.text,
        /Role <@&300000000000000003> je v seznamu rolí výš než role Logi, takže ji bot nemůže přidávat ani brát\.\n\*\*Co udělat\*\*\nV Discordu → Nastavení serveru → Role přetáhni roli Logi nad <@&300000000000000003>\. Role se doplní při další synchronizaci\./
    )
    const deleted = cardOf(
        await buildErrorReport(
            {
                guildId: "1",
                error: roleFailureError(report),
                source: "memberRoles",
                roleId: ROLE,
            },
            context({ event: null }),
            discord({}),
            SITE
        )
    )
    assert.match(deleted.text, /Role <@&300000000000000003> už neexistuje\./)
    const noManageRoles = cardOf(
        await buildErrorReport(
            {
                guildId: "1",
                error: roleFailureError({
                    reasons: ["discord_forbidden"],
                    discordCode: 50013,
                }),
                source: "memberRoles",
                roleId: ROLE,
            },
            context({ event: null }),
            discord({
                roles: { [ROLE]: { position: 2 } },
                serverDenied: [PermissionFlagsBits.ManageRoles],
            }),
            SITE
        )
    )
    assert.match(
        noManageRoles.text,
        /Role Logi nemá na serveru oprávnění Spravovat role\./
    )
    // The match roles name the role and the match (L5-19).
    const match = cardOf(
        await buildErrorReport(
            {
                guildId: "1",
                error: discordAnswer(50013),
                source: "eventRoles",
                eventId: "k17event",
                roleId: ROLE,
            },
            context(),
            discord({ roles: { [ROLE]: { position: 12 } }, botTop: 10 }),
            SITE
        )
    )
    assert.match(
        match.text,
        /-# VLK vs ROG · Přátelák · ne <t:\d+:d> · <t:\d+:t> · Role <@&300000000000000003>/
    )
    assert.match(match.text, /je v seznamu rolí výš než role Logi/)
})

test("the hidden panel password and a public seed control channel have their own entries (L5-16, P4-30, P4-B06)", async () => {
    const password = cardOf(
        await buildErrorReport(
            {
                guildId: "1",
                error: undefined,
                source: "panelPassword",
                channelId: PANELS,
                panel: "Vlci #2",
            },
            context({ event: null }),
            discord({ channels: [channel(PANELS, "klan-server")] }),
            SITE
        )
    )
    assert.equal(password.accent, 0x80848e)
    assert.match(
        password.text,
        /-# \*\*CHYBA BOTA · PANELY\*\*\n### Heslo serveru bylo z panelu odstraněno\n-# Panel Vlci #2 · Kanál <#100000000000000007>\n🟡 \*\*Zkusí se znovu po opravě\*\*/
    )
    assert.match(
        password.text,
        /\*\*Proč\*\*\nKanál <#100000000000000007> teď vidí všichni \(@everyone\)\. Heslo se ukazuje jen v kanálu, který @everyone nevidí\.\n\*\*Co udělat\*\*\nV Discordu otevři <#100000000000000007> → Upravit kanál → Oprávnění → @everyone a zakaž Zobrazit kanál\. Heslo se do panelu vrátí samo při dalším obnovení, do minuty\./
    )
    assert.deepEqual(password.buttons, [
        {
            label: "Panely v Logi",
            url: "https://logi.example/cs/dashboard/servers/k17server/settings/discord-panels",
        },
    ])
    assert.doesNotMatch(password.text, /Discord akci odmítl|Bot nemohl/)
    const seed = cardOf(
        await buildErrorReport(
            {
                guildId: "1",
                error: undefined,
                source: "seedControl",
                channelId: PANELS,
            },
            context({ event: null }),
            discord({ channels: [channel(PANELS, "spravci")] }),
            SITE
        )
    )
    assert.match(
        seed.text,
        /-# \*\*CHYBA BOTA · SEED\*\*\n### Ovládání serverů se neodeslalo\n-# Kanál <#100000000000000007>\n🟡 \*\*Zkusí se znovu po opravě\*\*/
    )
    assert.match(
        seed.text,
        /Kanál <#100000000000000007> vidí všichni \(@everyone\), a ovládání serverů patří jen správcům\.\n\*\*Co udělat\*\*\nNastav <#100000000000000007> jako soukromý, nebo v Logi → Seed serverů vyber jiný kanál pro ovládání\. Ovládání se pak pošle samo\./
    )
    assert.deepEqual(seed.buttons, [
        {
            label: "Seed serverů v Logi",
            url: "https://logi.example/cs/dashboard/servers/k17server/settings/discord-seed",
        },
    ])
    for (const language of ["en", "de"]) {
        const card = cardOf(
            await buildErrorReport(
                {
                    guildId: "1",
                    error: undefined,
                    source: "panelPassword",
                    channelId: PANELS,
                    panel: "Vlci #2",
                },
                context({ event: null, language }),
                discord({ channels: [channel(PANELS, "klan-server")] }),
                SITE
            )
        )
        assert.match(card.text, /@everyone/)
        assert.doesNotMatch(card.text, /Heslo|Kanál|Panely/)
    }
})

test("later steps of an open ticket or a decided application promise no retry (L5-24, L5-25, B03)", async () => {
    const intro = cardOf(
        await buildErrorReport(
            {
                guildId: "1",
                error: discordAnswer(50013),
                source: "ticketIntro",
                channelId: TICKETS,
                userId: "100000000000000017",
                categoryLabel: "Jiné",
                number: 12,
            },
            context({ event: null }),
            discord({
                channels: [
                    channel(TICKETS, "podpora", [
                        PermissionFlagsBits.EmbedLinks,
                    ]),
                ],
            }),
            SITE
        )
    )
    assert.match(
        intro.text,
        /### Úvod ticketu se neodeslal\n-# Kategorie Jiné · ticket #12 · autor <@100000000000000017>\n⚪ \*\*Bot to znovu nezkusí\*\*/
    )
    assert.match(
        intro.text,
        /Povol roli Logi v <#100000000000000002> oprávnění Vkládat odkazy\. Ticket je otevřený bez úvodní zprávy, hráči odpověz přímo ve vlákně\./
    )
    assert.doesNotMatch(intro.text, /Hráč dostal zprávu|ticket otevře znovu/)
    const rename = cardOf(
        await buildErrorReport(
            {
                guildId: "1",
                error: new Error("rename timed out after 5000ms."),
                source: "applicationRename",
                userId: "100000000000000017",
                categoryLabel: "Hlavní člen",
                number: 42,
            },
            context({ event: null }),
            discord({}),
            SITE
        )
    )
    assert.match(
        rename.text,
        /-# Kategorie Hlavní člen · přihláška #42 · uchazeč <@100000000000000017>\n⚪ \*\*Bot to znovu nezkusí\*\*/
    )
    assert.match(
        rename.text,
        /Discord neodpověděl včas\.\n\*\*Co udělat\*\*\nPřihláška funguje dál pod původním názvem, přejmenovat ji můžeš ručně\. Když se to opakuje přes hodinu, napiš podpoře Logi\./
    )
    // Opening is still the person's failed attempt (L5-12).
    const open = cardOf(
        await buildErrorReport(
            {
                guildId: "1",
                error: discordAnswer(50013),
                source: "ticketOpen",
                userId: "100000000000000017",
                categoryLabel: "Nahlásit hráče",
            },
            context({ event: null }),
            discord({
                channels: [
                    channel(TICKETS, "podpora", [
                        PermissionFlagsBits.CreatePrivateThreads,
                    ]),
                ],
            }),
            SITE
        )
    )
    assert.match(
        open.text,
        /-# Kategorie Nahlásit hráče · zkoušel <@100000000000000017>\n⚪ \*\*Hráč dostal zprávu, ať to zkusí později\*\*/
    )
})

test("a failed roster card is titled as the roster, not the announcement (L5-17)", async () => {
    const error = new EventSyncStepError("roster", discordAnswer(50013))
    assert.equal(eventSyncErrorSource(error), "roster")
    assert.equal(eventSyncErrorSource(new Error("x")), "announcement")
    const card = cardOf(
        await buildErrorReport(
            {
                guildId: "1",
                error,
                source: eventSyncErrorSource(error),
                eventId: "k17event",
            },
            context({ channels: { eventInfo: CALENDAR } }),
            discord({
                channels: [
                    channel(CALENDAR, "soupiska", [
                        PermissionFlagsBits.AttachFiles,
                    ]),
                ],
            }),
            SITE
        )
    )
    assert.match(
        card.text,
        /### Soupiska se nezveřejnila\n-# VLK vs ROG · Přátelák/
    )
    assert.match(
        card.text,
        /Bot nemá v kanálu <#100000000000000005> oprávnění Přikládat soubory\./
    )
    assert.match(
        card.text,
        /Soupiska se zveřejní sama při další synchronizaci, do 5 minut\./
    )
})
