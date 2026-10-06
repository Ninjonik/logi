import assert from "node:assert/strict"
import test from "node:test"

import {
    ChannelType,
    MessageFlags,
    type ButtonInteraction,
    type ModalSubmitInteraction,
} from "discord.js"

import {
    buildTicketModal,
    handleTicketButton,
    handleTicketModal,
    handleTicketSelect,
    type TicketPorts,
} from "./tickets"
import type { DiscordConfig, TicketCategory } from "../types"
import { buildTicketPanelMessage } from "./tickets-panel"

const GUILD = "700000000000000001"
const AUTHOR = "100000000000000017"
const ADMINI = "200000000000000001"
const SUPPORT_MEMBER = "100000000000000002"
const PARENT = "300000000000000001"
const THREAD = "300000000000000012"

const report: TicketCategory = {
    id: "report",
    label: "Nahlásit hráče",
    description: "chování na serveru",
    supportRoleIds: [ADMINI],
    threadTitle: "{author} nahlašuje hráče",
    modalQuestions: [
        {
            id: "who",
            label: "Kdo? Jméno ve hře",
            placeholder: "Přesně jak je ve hře",
            style: "short",
            required: true,
        },
        {
            id: "where",
            label: "Kde a kdy?",
            placeholder: "Server a přibližný čas",
            style: "short",
            required: false,
        },
        {
            id: "what",
            label: "Co se stalo?",
            placeholder: "Popiš to stručně, odkaz na video pomůže.",
            style: "paragraph",
            required: true,
        },
    ],
}
const other: TicketCategory = {
    id: "other",
    label: "Jiné",
    supportRoleIds: [],
    modalQuestions: [],
}

function config(overrides: Partial<DiscordConfig> = {}): DiscordConfig {
    return {
        id: "config",
        guildId: GUILD,
        timezone: "Europe/Prague",
        defaultLanguage: "cs",
        calendarCategories: [],
        updatedAt: "2026-10-01T00:00:00Z",
        ticketSettings: {
            enabled: true,
            submitChannelId: "300000000000000009",
            ticketParentChannelId: PARENT,
            panelTitle: "Potřebuješ pomoc?",
            panelDescription:
                "Vyber, s čím potřebuješ pomoct. Otevře se soukromé vlákno, které vidíš jen ty a správci.",
            categories: [report, other],
        },
        ...overrides,
    }
}

type Reported = {
    source: string | undefined
    userId: string | undefined
    categoryLabel: string | undefined
    number: number | undefined
    channelId: string | undefined
    error: unknown
}

function fakePorts(input: {
    config?: DiscordConfig | null
    recordFails?: boolean
    reports?: Reported[]
    records?: unknown[]
}): TicketPorts {
    return {
        config: async () =>
            input.config === undefined ? config() : input.config,
        createRecord: async (value) => {
            input.records?.push(value)
            if (input.recordFails) throw new Error("Convex down")
            return {
                ticket: {
                    ticketNumber: 12,
                    categoryLabel:
                        value.categoryId === "report"
                            ? "Nahlásit hráče"
                            : "Jiné",
                    threadId: value.threadId,
                },
            }
        },
        storeIntroMessage: async () => {},
        reporter: async (value) => {
            input.reports?.push({
                source: value.source,
                userId: value.userId,
                categoryLabel: value.categoryLabel,
                number: value.number,
                channelId: value.channelId,
                error: value.error,
            })
        },
        now: () => Date.parse("2026-10-11T18:31:00Z"),
    }
}

function fakeGuild(input: {
    parentType?: ChannelType
    threadFails?: boolean
    /** Later steps Discord refuses: adding support, the intro, the name. */
    refuse?: ReadonlyArray<"add" | "send" | "name">
    calls: string[]
    sent: unknown[]
}) {
    const refused = () =>
        Object.assign(new Error("Missing Permissions"), { code: 50013 })
    const thread = {
        id: THREAD,
        name: "Nahlásit hráče",
        parentId: PARENT,
        guildId: GUILD,
        client: {},
        members: {
            add: async (id: string) => {
                input.calls.push(`add:${id}`)
                if (input.refuse?.includes("add")) throw refused()
            },
        },
        send: async (value: unknown) => {
            if (input.refuse?.includes("send")) throw refused()
            input.sent.push(value)
            return { id: "500000000000000001" }
        },
        setName: async (name: string) => {
            input.calls.push(`name:${name}`)
            if (input.refuse?.includes("name")) throw refused()
        },
        delete: async () => {
            input.calls.push("delete")
        },
    }
    const parent = {
        id: PARENT,
        type: input.parentType ?? ChannelType.GuildText,
        threads: {
            create: async (options: { name: string; type: ChannelType }) => {
                input.calls.push(`create:${options.name}:${options.type}`)
                if (input.threadFails) throw new Error("Missing Permissions")
                return thread
            },
        },
    }
    const members = new Map([
        [
            SUPPORT_MEMBER,
            {
                id: SUPPORT_MEMBER,
                roles: { cache: new Map([[ADMINI, {}]]) },
            },
        ],
    ])
    return {
        id: GUILD,
        channels: { fetch: async () => parent },
        members: { fetch: async () => members, cache: members },
    }
}

function interaction<T>(fields: Record<string, unknown>) {
    const replies: Array<{ kind: string; value: unknown }> = []
    const state = {
        deferred: false,
        replied: false,
        ephemeral: null as boolean | null,
    }
    const value = Object.assign(state, {
        guildId: GUILD,
        user: {
            id: AUTHOR,
            tag: "hrac17",
            username: "hrac17",
            globalName: "Hráč 17",
        },
        member: { displayName: "Hráč 17" },
        client: {},
        deferReply: async (options: { flags?: number } = {}) => {
            state.deferred = true
            state.ephemeral = options.flags === MessageFlags.Ephemeral
        },
        reply: async (body: unknown) => {
            state.replied = true
            replies.push({ kind: "reply", value: body })
        },
        editReply: async (body: unknown) => {
            replies.push({ kind: "edit", value: body })
        },
        followUp: async (body: unknown) => {
            replies.push({ kind: "followUp", value: body })
        },
        deleteReply: async () => {},
        ...fields,
    })
    return { interaction: value as unknown as T, replies }
}

test("the panel is one V2 card with grey category buttons and the clan or panel colour (L4-35..37, L4-45)", () => {
    const message = buildTicketPanelMessage(config(), "https://logi.example")
    assert.ok(message)
    const json = JSON.stringify(
        message.components.map((component) => component.toJSON())
    )
    assert.equal(message.flags, MessageFlags.IsComponentsV2)
    assert.match(json, /"accent_color":15246141/)
    assert.match(json, /### Potřebuješ pomoc\?/)
    assert.match(json, /\*\*Nahlásit hráče\*\* · chování na serveru/)
    assert.match(
        json,
        /"label":"Nahlásit hráče","disabled":false,"style":2,"custom_id":"ticket:report"/
    )
    assert.doesNotMatch(json, /Automatic updates/)
    const custom = buildTicketPanelMessage(
        config({
            ticketSettings: {
                ...config().ticketSettings!,
                panelAccentColor: "#3366FF",
            },
        })
    )
    assert.match(
        JSON.stringify(custom!.components.map((c) => c.toJSON())),
        /"accent_color":3368703/
    )
})

test("a category with questions opens its window with the board's labels (L4-38)", async () => {
    const modals: unknown[] = []
    const { interaction: button } = interaction<ButtonInteraction>({
        customId: "ticket:report",
        showModal: async (modal: { toJSON(): unknown }) => {
            modals.push(modal.toJSON())
        },
    })
    await handleTicketButton(button, fakePorts({}))
    const json = JSON.stringify(modals)
    assert.match(json, /"custom_id":"ticket-modal:report"/)
    assert.match(json, /"title":"Nahlásit hráče"/)
    assert.match(json, /"label":"Kdo\? Jméno ve hře"/)
    assert.match(json, /"placeholder":"Přesně jak je ve hře"/)
    assert.match(json, /"required":true/)
    assert.match(json, /"label":"Co se stalo\?"/)
    assert.deepEqual(
        (buildTicketModal(report, "cs").toJSON() as { components: unknown[] })
            .components.length,
        3
    )
})

test("switched-off tickets and a removed category get their private cards (L4-41)", async () => {
    const off = interaction<ButtonInteraction>({ customId: "ticket:report" })
    await handleTicketButton(
        off.interaction,
        fakePorts({
            config: config({
                ticketSettings: { ...config().ticketSettings!, enabled: false },
            }),
        })
    )
    assert.match(JSON.stringify(off.replies), /Tickety jsou teď vypnuté/)
    assert.match(
        JSON.stringify(off.replies),
        /Napiš správcům přímo, nebo to zkus později\./
    )
    const gone = interaction<ButtonInteraction>({ customId: "ticket:deleted" })
    await handleTicketButton(gone.interaction, fakePorts({}))
    assert.match(JSON.stringify(gone.replies), /Tahle nabídka už neplatí/)
})

test("submitting the window opens the private thread with the card, restricted pings and the final name (L4-39, L4-42, L4-45, L4-B05)", async () => {
    const calls: string[] = []
    const sent: unknown[] = []
    const records: unknown[] = []
    const answers: Record<string, string> = {
        who: "xX_Sniper_Xx",
        where: "Vlci #1, dnes kolem 20:15",
        what: "Opakovaně zabíjel vlastní tým u základny. Video v příloze.",
    }
    const { interaction: modal, replies } = interaction<ModalSubmitInteraction>(
        {
            customId: "ticket-modal:report",
            guild: fakeGuild({ calls, sent }),
            fields: { getTextInputValue: (id: string) => answers[id] ?? "" },
        }
    )
    await handleTicketModal(modal, fakePorts({ records }))
    assert.deepEqual(calls, [
        `create:Nahlásit hráče:${ChannelType.PrivateThread}`,
        `add:${AUTHOR}`,
        `add:${SUPPORT_MEMBER}`,
        "name:Nahlásit hráče #12",
    ])
    assert.deepEqual(records, [
        {
            guildId: GUILD,
            threadId: THREAD,
            parentChannelId: PARENT,
            creatorId: AUTHOR,
            categoryId: "report",
            answers: [
                {
                    questionId: "who",
                    label: "Kdo? Jméno ve hře",
                    value: "xX_Sniper_Xx",
                },
                {
                    questionId: "where",
                    label: "Kde a kdy?",
                    value: "Vlci #1, dnes kolem 20:15",
                },
                {
                    questionId: "what",
                    label: "Co se stalo?",
                    value: "Opakovaně zabíjel vlastní tým u základny. Video v příloze.",
                },
            ],
        },
    ])
    const intro = sent[0] as {
        components: Array<{ toJSON(): unknown }>
        allowedMentions: unknown
        flags: number
    }
    assert.deepEqual(intro.allowedMentions, {
        users: [AUTHOR],
        roles: [ADMINI],
        parse: [],
    })
    assert.equal(intro.flags, MessageFlags.IsComponentsV2)
    const json = JSON.stringify(intro.components.map((c) => c.toJSON()))
    assert.match(json, new RegExp(`"content":"<@${AUTHOR}> <@&${ADMINI}>"`))
    assert.match(json, /TICKET #12 · NAHLÁSIT HRÁČE/)
    assert.match(json, /### Hráč 17 nahlašuje hráče/)
    assert.match(json, /Otevřený/)
    assert.match(json, /Otevřeno ne <t:1791743460:d> · <t:1791743460:t>/)
    assert.match(json, /Kdo\? Jméno ve hře\*\*\\nxX\\\\_Sniper\\\\_Xx/)
    assert.match(
        json,
        /Ticket uzavře podpora příkazem \/close_ticket · Spravováno v Logi/
    )
    const reply = JSON.stringify(replies.at(-1))
    assert.match(reply, /Ticket #12 je otevřený/)
    assert.match(
        reply,
        new RegExp(
            `Pokračuj ve vlákně <#${THREAD}>\\. Podpora se ti ozve tam\\.`
        )
    )
    assert.match(reply, /Otevřít vlákno/)
})

test("a category without questions opens the ticket straight from the button", async () => {
    const calls: string[] = []
    const sent: unknown[] = []
    const { interaction: button, replies } = interaction<ButtonInteraction>({
        customId: "ticket:other",
        guild: fakeGuild({ calls, sent }),
    })
    await handleTicketButton(button, fakePorts({}))
    assert.equal(sent.length, 1)
    assert.match(
        JSON.stringify(
            (
                sent[0] as { components: Array<{ toJSON(): unknown }> }
            ).components[1]!.toJSON()
        ),
        /### Hráč 17 · Jiné/
    )
    assert.match(JSON.stringify(replies.at(-1)), /Ticket #12 je otevřený/)
})

test("the select of a large panel opens the chosen category", async () => {
    const modals: unknown[] = []
    const { interaction: select } = interaction<never>({
        customId: "ticket-pick",
        values: ["report"],
        showModal: async (modal: { toJSON(): unknown }) => {
            modals.push(modal.toJSON())
        },
    })
    await handleTicketSelect(select, fakePorts({}))
    assert.match(JSON.stringify(modals), /ticket-modal:report/)
})

test("failures an admin must fix: the person reads one card, the errors channel gets the cause (L4-40, L4-B06)", async () => {
    for (const scenario of [
        { parentType: ChannelType.GuildVoice, failure: "channel_type" },
        { threadFails: true, failure: "Missing Permissions" },
        { recordFails: true, failure: "Convex down" },
    ]) {
        const calls: string[] = []
        const reports: Reported[] = []
        const { interaction: button, replies } = interaction<ButtonInteraction>(
            {
                customId: "ticket:other",
                guild: fakeGuild({
                    calls,
                    sent: [],
                    parentType: scenario.parentType,
                    threadFails: scenario.threadFails,
                }),
            }
        )
        await handleTicketButton(
            button,
            fakePorts({ reports, recordFails: scenario.recordFails })
        )
        const text = JSON.stringify(replies)
        assert.match(text, /Ticket se nepodařilo otevřít/)
        assert.match(
            text,
            /Nic se neuložilo\. Správci dostali upozornění; zkus to prosím za chvíli znovu\./
        )
        assert.doesNotMatch(text, /oprávnění bota|Missing Permissions/)
        // The entry names the category and who tried (L5-12).
        assert.equal(reports.length, 1)
        assert.deepEqual(
            {
                ...reports[0],
                error: undefined,
            },
            {
                source: "ticketOpen",
                userId: AUTHOR,
                categoryLabel: "Jiné",
                number: undefined,
                channelId: PARENT,
                error: undefined,
            }
        )
        const error = reports[0]!.error as { reason?: string; message: string }
        assert.equal(error.reason ?? error.message, scenario.failure)
        if (scenario.recordFails) assert.ok(calls.includes("delete"))
    }
})

test("later steps of an open ticket are reported with the ticket, its author and no retry promise (L5-24)", async () => {
    const calls: string[] = []
    const reports: Reported[] = []
    const { interaction: button, replies } = interaction<ButtonInteraction>({
        customId: "ticket:other",
        guild: fakeGuild({
            calls,
            sent: [],
            refuse: ["add", "send", "name"],
        }),
    })
    await handleTicketButton(button, fakePorts({ reports }))
    // The author still reads that the ticket is open.
    assert.match(JSON.stringify(replies.at(-1)), /Ticket #12 je otevřený/)
    assert.deepEqual(
        reports.map((report) => ({ ...report, error: undefined })),
        [
            {
                source: "ticketSupport",
                userId: AUTHOR,
                categoryLabel: "Jiné",
                number: undefined,
                channelId: PARENT,
                error: undefined,
            },
            {
                source: "ticketIntro",
                userId: AUTHOR,
                categoryLabel: "Jiné",
                number: 12,
                channelId: PARENT,
                error: undefined,
            },
            {
                source: "ticketRename",
                userId: AUTHOR,
                categoryLabel: "Jiné",
                number: 12,
                channelId: PARENT,
                error: undefined,
            },
        ]
    )
})
