import assert from "node:assert/strict"
import test from "node:test"

import { MessageFlags, type ChatInputCommandInteraction } from "discord.js"

import {
    handleCloseTicketCommand,
    type CloseTicketPorts,
    type TicketThreadContext,
} from "./close-ticket"
import { createInteractionHandler } from "../interactions"
import { closeTicketInteractions } from "./close-ticket"
import { createInteractionRegistry } from "./registry"

const GUILD = "700000000000000001"
const THREAD = "444444444444444444"
const CLOSER = "222222222222222222"
const AUTHOR = "333333333333333333"
const SUPPORT = "555555555555555555"

function context(
    overrides: Partial<TicketThreadContext["ticket"]> = {}
): TicketThreadContext {
    return {
        config: {
            id: "config",
            guildId: GUILD,
            timezone: "Europe/Prague",
            defaultLanguage: "cs",
            calendarCategories: [],
            dashboardAdminRoleId: "666666666666666666",
            messageStyle: { accentColor: "#3366CC" },
            updatedAt: "2026-10-01T00:00:00Z",
        },
        ticket: {
            id: "ticket",
            guildId: GUILD,
            threadId: THREAD,
            parentChannelId: "111111111111111111",
            creatorId: AUTHOR,
            categoryId: "report",
            categoryLabel: "Nahlásit hráče",
            ticketNumber: 12,
            status: "open",
            answers: [],
            openedAt: "2026-10-11T18:31:00Z",
            createdAt: "2026-10-11T18:31:00Z",
            updatedAt: "2026-10-11T18:31:00Z",
            ...overrides,
        },
        category: {
            id: "report",
            label: "Nahlásit hráče",
            supportRoleIds: [SUPPORT],
            modalQuestions: [],
        },
    }
}

/** A clan colour other than the default amber (#E8A33D). */
const CLAN_ACCENT = "#3366CC"
const CLAN_ACCENT_INT = 0x3366cc

function ports(input: {
    thread?: TicketThreadContext | null
    closes?: unknown[]
    reports?: unknown[]
}): CloseTicketPorts {
    return {
        thread: async () =>
            input.thread === undefined ? context() : input.thread,
        close: async (value) => {
            input.closes?.push(value)
        },
        settingsUrl: () => "https://logi.example/cs/dashboard/settings/user",
        kit: async () => ({
            language: "cs",
            style: { accentColor: CLAN_ACCENT },
        }),
        reporter: async (value) => {
            input.reports?.push(value)
        },
        now: () => Date.parse("2026-10-11T19:12:00Z"),
    }
}

type Sent = { to: string; value: unknown }

function command(input: {
    inThread?: boolean
    roles?: string[]
    rolesFail?: boolean
    dmFails?: boolean
    cardFails?: boolean
    fail?: Array<"rename" | "lock" | "archive">
    reason?: string | null
}) {
    const sent: Sent[] = []
    const calls: string[] = []
    const state = {
        deferred: false,
        replied: false,
        ephemeral: null as boolean | null,
    }
    const record = (to: string) => async (value: unknown) => {
        sent.push({ to, value })
    }
    const guild = {
        name: "Vlci",
        fetch: async () => {
            calls.push("guild")
            return guild
        },
        roles: {
            fetch: async () => {
                calls.push("roles")
                if (input.rolesFail) throw new Error("Discord unavailable")
            },
        },
        members: {
            fetch: async (args: { user: string; force: boolean }) => {
                calls.push(`member:${args.force}`)
                return {
                    permissions: { has: () => false },
                    roles: {
                        cache: new Map(
                            (input.roles ?? []).map((id) => [id, {}])
                        ),
                    },
                }
            },
        },
    }
    const interaction = Object.assign(state, {
        commandName: "close_ticket",
        guildId: GUILD,
        channelId: THREAD,
        inGuild: () => true,
        user: { id: CLOSER, username: "hrac02", globalName: "Hráč 02" },
        member: { displayName: "Hráč 02", permissions: { has: () => true } },
        channel: {
            isThread: () => input.inThread ?? true,
            send: async (value: unknown) => {
                if (input.cardFails)
                    throw Object.assign(new Error("Missing Permissions"), {
                        code: 50013,
                    })
                sent.push({ to: "thread", value })
            },
            setName: async (name: string) => {
                if (input.fail?.includes("rename"))
                    throw new Error("Missing Permissions")
                calls.push(`name:${name}`)
            },
            setLocked: async () => {
                if (input.fail?.includes("lock"))
                    throw new Error("Missing Permissions")
                calls.push("locked")
            },
            setArchived: async () => {
                if (input.fail?.includes("archive"))
                    throw new Error("Missing Permissions")
                calls.push("archived")
            },
        },
        guild,
        client: {
            users: {
                fetch: async () => ({
                    send: async (value: unknown) => {
                        if (input.dmFails) throw new Error("Cannot send")
                        sent.push({ to: "dm", value })
                    },
                }),
            },
            guilds: { fetch: async () => guild },
        },
        options: {
            getString: (name: string) =>
                name === "reason"
                    ? input.reason === undefined
                        ? "Hráč dostal ban na 7 dní. Díky za nahlášení."
                        : input.reason
                    : null,
        },
        deferReply: async (value: { flags?: number } = {}) => {
            state.deferred = true
            state.ephemeral = value.flags === MessageFlags.Ephemeral
        },
        reply: async (value: unknown) => {
            state.replied = true
            sent.push({ to: "reply", value })
        },
        editReply: record("reply"),
        followUp: record("reply"),
        deleteReply: async () => {},
    })
    return {
        interaction: interaction as unknown as ChatInputCommandInteraction,
        sent,
        calls,
        text: (to: string) =>
            JSON.stringify(
                sent.filter((entry) => entry.to === to).map((e) => e.value)
            ),
    }
}

test("support closes the ticket: close card, DM, renamed, locked, archived and the reply (M3-28, M3-30, L4-43..45)", async () => {
    const closes: unknown[] = []
    const fake = command({ roles: [SUPPORT] })
    await handleCloseTicketCommand(fake.interaction, ports({ closes }))
    assert.deepEqual(closes, [
        {
            threadId: THREAD,
            closedByUserId: CLOSER,
            closeReason: "Hráč dostal ban na 7 dní. Díky za nahlášení.",
        },
    ])
    // The same fresh check as /close_application (M3-04, M3-B05).
    assert.deepEqual(fake.calls.slice(0, 3), ["guild", "roles", "member:true"])
    const thread = fake.text("thread")
    assert.match(thread, /TICKET #12 · UZAVŘEN/)
    assert.match(thread, /### Vyřešeno/)
    assert.match(thread, new RegExp(`Zavřel <@${CLOSER}>`))
    assert.match(thread, /> Hráč dostal ban na 7 dní/)
    const dm = fake.text("dm")
    assert.match(dm, /KLAN VLCI · TICKET #12/)
    assert.match(dm, /Tvůj ticket je vyřešený/)
    assert.match(dm, /Nahlásit hráče · zavřel Hráč 02/)
    assert.match(dm, /Otevřít vlákno/)
    assert.match(dm, /Klan Vlci · \[Nastavit zprávy\]/)
    assert.doesNotMatch(dm, /this server/)
    assert.deepEqual(fake.calls.slice(3), [
        "name:uzavřeno · Nahlásit hráče #12",
        "locked",
        "archived",
    ])
    const reply = fake.text("reply")
    assert.match(reply, /Ticket #12 je uzavřený/)
    assert.match(
        reply,
        /Shrnutí je ve vlákně a autor ho dostal do DM\. Vlákno je zamčené a archivované\./
    )
})

test("a closed DM is reported in the reply, not hidden (M3-31, M3-B06)", async () => {
    const fake = command({ roles: [SUPPORT], dmFails: true })
    await handleCloseTicketCommand(fake.interaction, ports({}))
    assert.equal(fake.text("dm"), "[]")
    assert.match(
        fake.text("reply"),
        /Autorovi nejde poslat DM, shrnutí najde ve vlákně\./
    )
})

test("with the ticket-closed DM switched off the author gets no DM and the reply says so (N1-42)", async () => {
    const base = context()
    const fake = command({ roles: [SUPPORT] })
    await handleCloseTicketCommand(fake.interaction, {
        ...ports({}),
        thread: async () => ({
            ...base,
            config: { ...base.config, ticketCloseDmEnabled: false },
        }),
    })
    assert.equal(fake.text("dm"), "[]")
    assert.match(fake.text("reply"), /DM o uzavření ticketu má klan vypnutou/)
    assert.ok(fake.calls.includes("archived"))
})

test("a refused lock and archive go to the errors channel and the reply says they did not happen (M3-07, M3-B02)", async () => {
    const reports: unknown[] = []
    const closes: unknown[] = []
    const fake = command({ roles: [SUPPORT], fail: ["lock", "archive"] })
    await handleCloseTicketCommand(fake.interaction, ports({ reports, closes }))
    assert.equal(closes.length, 1, "the ticket is still closed in Logi")
    const reply = fake.text("reply")
    assert.match(reply, /Ticket #12 je uzavřený/)
    assert.match(
        reply,
        /Shrnutí je ve vlákně a autor ho dostal do DM\. Vlákno se nepodařilo zamknout ani archivovat\. Správci dostali upozornění\./
    )
    assert.doesNotMatch(reply, /Vlákno je zamčené a archivované/)
    assert.equal(reports.length, 1, "one entry for the thread")
    const entry = reports[0] as Record<string, unknown>
    assert.equal(entry.source, "ticketCloseThread")
    assert.equal(entry.guildId, GUILD)
    assert.equal(entry.channelId, "111111111111111111")
    assert.equal(entry.number, 12)
    assert.equal(entry.categoryLabel, "Nahlásit hráče")
    assert.equal(entry.userId, CLOSER)
    assert.match(String((entry.error as Error).message), /Missing Permissions/)
})

test("a close card Discord refused is reported and the reply does not claim the summary is in the thread (M3-07)", async () => {
    const reports: unknown[] = []
    const fake = command({ roles: [SUPPORT], cardFails: true, dmFails: true })
    await handleCloseTicketCommand(fake.interaction, ports({ reports }))
    assert.equal(fake.text("thread"), "[]")
    const reply = fake.text("reply")
    assert.match(
        reply,
        /Shrnutí se do vlákna nepodařilo poslat a autorovi nejde poslat DM\. Vlákno je zamčené a archivované\. Správci dostali upozornění\./
    )
    assert.deepEqual(
        reports.map((entry) => (entry as { source: string }).source),
        ["ticketCloseCard"]
    )
    // A closed DM is the author's choice, never an admin's to fix (L2-63).
    assert.ok(fake.calls.includes("archived"))
})

test("a failed rename alone is named on its own; everything failing names every step", async () => {
    const renameReports: unknown[] = []
    const rename = command({ roles: [SUPPORT], fail: ["rename"] })
    await handleCloseTicketCommand(
        rename.interaction,
        ports({ reports: renameReports })
    )
    assert.match(rename.text("reply"), /Vlákno se nepodařilo přejmenovat\./)
    assert.deepEqual(rename.calls.slice(3), ["locked", "archived"])
    assert.equal(renameReports.length, 1)

    const allReports: unknown[] = []
    const all = command({
        roles: [SUPPORT],
        cardFails: true,
        fail: ["rename", "lock", "archive"],
    })
    await handleCloseTicketCommand(
        all.interaction,
        ports({ reports: allReports })
    )
    assert.match(
        all.text("reply"),
        /Shrnutí se do vlákna nepodařilo poslat, autor ho dostal do DM\. Vlákno se nepodařilo přejmenovat, zamknout ani archivovat\./
    )
    assert.deepEqual(
        allReports.map((entry) => (entry as { source: string }).source),
        ["ticketCloseCard", "ticketCloseThread"]
    )
})

test("the honest reply exists in English and German too", async () => {
    for (const [language, expected] of [
        [
            "en",
            /The summary is in the thread and the author got it by DM\. The thread couldn't be locked or archived\. The admins have been notified\./,
        ],
        [
            "de",
            /Der Thread konnte nicht gesperrt oder archiviert werden\. Die Admins wurden benachrichtigt\./,
        ],
    ] as const) {
        const base = context()
        const fake = command({ roles: [SUPPORT], fail: ["lock", "archive"] })
        await handleCloseTicketCommand(fake.interaction, {
            ...ports({}),
            thread: async () => ({
                ...base,
                config: { ...base.config, defaultLanguage: language },
            }),
        })
        assert.match(fake.text("reply"), expected)
    }
})

test("everything done reports nothing", async () => {
    const reports: unknown[] = []
    const fake = command({ roles: [SUPPORT] })
    await handleCloseTicketCommand(fake.interaction, ports({ reports }))
    assert.deepEqual(reports, [])
})

test("without a reason the close card has no quote and no 'Nebyl uveden důvod' (L4-34)", async () => {
    const fake = command({ roles: [SUPPORT], reason: null })
    await handleCloseTicketCommand(fake.interaction, ports({}))
    assert.doesNotMatch(fake.text("thread"), /"content":"> /)
    assert.doesNotMatch(fake.text("thread"), /Nebyl uveden důvod/)
})

test("refusals: not allowed names the support roles, roles unverifiable, outside, not a ticket, already closed (M3-32..36)", async () => {
    const closes: unknown[] = []
    const denied = command({ roles: ["777777777777777777"] })
    await handleCloseTicketCommand(denied.interaction, ports({ closes }))
    assert.match(
        denied.text("reply"),
        /Tento ticket můžou zavřít jen podpora a správci/
    )
    assert.match(
        denied.text("reply"),
        new RegExp(
            `Ticket z kategorie Nahlásit hráče zavírá <@&${SUPPORT}> nebo správci Logi`
        )
    )

    const unverifiable = command({ roles: [SUPPORT], rolesFail: true })
    await handleCloseTicketCommand(unverifiable.interaction, ports({ closes }))
    assert.match(unverifiable.text("reply"), /Teď nejde ověřit tvoje role/)

    const outside = command({ inThread: false })
    await handleCloseTicketCommand(outside.interaction, ports({ closes }))
    assert.match(
        outside.text("reply"),
        /close\\\\_ticket funguje jen ve vlákně ticketu/
    )
    assert.doesNotMatch(outside.text("reply"), /Use this command/)

    const notTicket = command({ roles: [SUPPORT] })
    await handleCloseTicketCommand(
        notTicket.interaction,
        ports({ thread: null, closes })
    )
    assert.match(notTicket.text("reply"), /Tohle vlákno není ticket/)

    const already = command({ roles: [SUPPORT] })
    await handleCloseTicketCommand(
        already.interaction,
        ports({ thread: context({ status: "closed" }), closes })
    )
    assert.match(already.text("reply"), /Ticket #12 je už uzavřený/)
    assert.match(already.text("reply"), /Nic dalšího není potřeba\./)

    assert.deepEqual(closes, [])
    for (const fake of [denied, unverifiable, outside, notTicket, already]) {
        const reply = fake.sent.find((entry) => entry.to === "reply")
        assert.ok(reply)
        const flags = (reply.value as { flags?: number }).flags ?? 0
        // Private, Components V2, in the clan colour.
        assert.ok(
            fake.interaction.deferred
                ? true
                : (flags & MessageFlags.Ephemeral) !== 0
        )
        // The clan's own colour, also before the ticket is known (M3-06).
        assert.match(
            JSON.stringify(reply.value),
            new RegExp(`"accent_color":${CLAN_ACCENT_INT}`)
        )
    }
})

test("/close_ticket is routed by the registry, not the old dispatch", async () => {
    const closes: unknown[] = []
    const handler = createInteractionHandler({
        enqueueEventSync: () => {},
        triggerPollSoon: () => {},
        registry: createInteractionRegistry(
            [closeTicketInteractions(() => ports({ closes }))],
            { enqueueEventSync: () => {}, triggerPollSoon: () => {} }
        ),
    })
    const fake = command({ roles: [SUPPORT] })
    await handler.handleChatInputCommand(fake.interaction)
    assert.equal(closes.length, 1)
})
