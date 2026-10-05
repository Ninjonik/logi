import test, { afterEach, type TestContext } from "node:test"
import assert from "node:assert/strict"

import {
    ChannelType,
    MessageFlags,
    type ButtonInteraction,
    type ModalSubmitInteraction,
} from "discord.js"
import { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"

import type { ApplicationAnswers } from "../../../src/domain/membership/application-plan"
import { defaultApplicationForm } from "../../../src/domain/membership/application-form"
import { getApplicationMessages } from "../../../src/lib/clan-language/application"

import {
    handleApplicationButton,
    handleApplicationStart,
    handleWindowModal,
} from "./membership-application"
import type { ApplicationState } from "./membership-application-store"
import { closeConvexClient } from "../convex"

afterEach(closeConvexClient)

const userId = "333333333333333333"
const categories = [
    {
        id: "main",
        gameId: "hell_let_loose" as const,
        label: "Člen",
        description: "zápasy každý týden",
        assignmentType: "member" as const,
        supportRoleIds: ["recruiters"],
        recruitRoleIds: [],
        finalRoleIds: [],
    },
    {
        id: "merc",
        gameId: "wardogs" as const,
        label: "Žoldák",
        assignmentType: "mercenary" as const,
        supportRoleIds: [],
        recruitRoleIds: [],
        finalRoleIds: [],
    },
]
const form = defaultApplicationForm(
    categories,
    getApplicationMessages("cs").defaultForm
)

function state(patch: Partial<ApplicationState> = {}): ApplicationState {
    return {
        enabled: true,
        webFormEnabled: false,
        language: "cs",
        timeZone: "Europe/Prague",
        clanName: "Vlci",
        guildRecordId: "guild-record",
        panelChannelId: "555",
        parentChannelId: "666",
        ticketChannelId: "777",
        form,
        categories,
        openApplication: null,
        assignedGames: [],
        draft: null,
        verifiedSteamId: null,
        previousPlayers: [],
        linkedPlatformIds: [],
        messageStyle: null,
        ...patch,
    }
}

type Json = { type: number; [key: string]: unknown }

function texts(payload: unknown): string {
    const components = (payload as { components?: { toJSON(): Json }[] })
        .components
    const walk = (component: Json): string[] => [
        ...(component.type === 10 ? [String(component.content)] : []),
        ...((component.components as Json[] | undefined) ?? []).flatMap(walk),
        ...(component.accessory ? walk(component.accessory as Json) : []),
    ]
    return (components ?? [])
        .map((component) =>
            walk(JSON.parse(JSON.stringify(component.toJSON())))
        )
        .flat()
        .join("\n")
}

function backend(
    t: TestContext,
    states: ApplicationState[],
    results: Record<string, unknown> = {}
) {
    const writes: Array<{ name: string; args: Record<string, unknown> }> = []
    let reads = 0
    t.mock.method(
        ConvexReactClient.prototype,
        "query",
        async (reference: Parameters<typeof getFunctionName>[0]) => {
            const name = getFunctionName(reference)
            if (name === "membershipApplications:getApplicationState")
                return states[Math.min(reads++, states.length - 1)]
            return { defaultLanguage: "cs" }
        }
    )
    t.mock.method(
        ConvexReactClient.prototype,
        "mutation",
        async (
            reference: Parameters<typeof getFunctionName>[0],
            args: Record<string, unknown>
        ) => {
            const name = getFunctionName(reference)
            writes.push({ name, args })
            return results[name] ?? { ok: true }
        }
    )
    // The Steam watch would subscribe; tests never reach the network.
    t.mock.method(ConvexReactClient.prototype, "watchQuery", () => ({
        onUpdate: () => () => {},
        localQueryResult: () => undefined,
    }))
    return writes
}

function interaction(input: {
    customId: string
    ephemeralMessage?: boolean
    fields?: Record<string, unknown>
    guild?: Record<string, unknown>
}) {
    const replies: unknown[] = []
    const modals: unknown[] = []
    const value = {
        customId: input.customId,
        guildId: "123456789012345678",
        guild: {
            id: "123456789012345678",
            name: "Vlci",
            systemChannelId: "888",
            ...input.guild,
        },
        user: {
            id: userId,
            username: "hrac17",
            globalName: "Hráč 17",
            tag: "hrac17",
            displayAvatarURL: () => "https://cdn.example/avatar.png",
            send: async () => {},
        },
        member: { displayName: "Hráč 17" },
        message: {
            flags: {
                has: (flag: number) =>
                    Boolean(input.ephemeralMessage) &&
                    flag === MessageFlags.Ephemeral,
            },
        },
        replied: false,
        deferred: false,
        isButton: () => !input.fields,
        isStringSelectMenu: () => false,
        isModalSubmit: () => Boolean(input.fields),
        isFromMessage: () => Boolean(input.ephemeralMessage),
        reply: async (payload: unknown) => {
            value.replied = true
            replies.push(payload)
        },
        update: async (payload: unknown) => {
            replies.push(payload)
        },
        editReply: async (payload: unknown) => {
            replies.push(payload)
        },
        deferUpdate: async () => {
            value.deferred = true
        },
        showModal: async (modal: unknown) => {
            modals.push(modal)
        },
        fields: {
            getField: (id: string) => {
                const field = input.fields?.[id]
                if (!field) throw new Error("missing")
                return field
            },
        },
    }
    return { value, replies, modals }
}

test("closed applications answer privately where to ask (L6-57)", async (t) => {
    backend(t, [state({ enabled: false })])
    const { value, replies } = interaction({ customId: "membership:apply" })
    await handleApplicationStart(value as unknown as ButtonInteraction)
    assert.match(
        texts(replies[0]),
        /### Přihlášky jsou teď zavřené\nZkus to později, nebo se zeptej správců v <#888>\./
    )
    assert.equal(
        (replies[0] as { flags: number }).flags & MessageFlags.Ephemeral,
        MessageFlags.Ephemeral
    )
})

test("an open application links its thread (L6-56)", async (t) => {
    backend(t, [state({ openApplication: { number: 41, threadId: "999" } })])
    const { value, replies } = interaction({ customId: "membership:apply" })
    await handleApplicationStart(value as unknown as ButtonInteraction)
    assert.match(texts(replies[0]), /### Už máš otevřenou přihlášku #41/)
    assert.match(
        JSON.stringify(replies),
        /discord\.com\/channels\/123456789012345678\/999/
    )
})

test("a member of every game is told to use a ticket (L6-55)", async (t) => {
    backend(t, [state({ assignedGames: ["hell_let_loose", "wardogs"] })])
    const { value, replies } = interaction({ customId: "membership:apply" })
    await handleApplicationStart(value as unknown as ButtonInteraction)
    assert.match(
        texts(replies[0]),
        /### V klanu Vlci už jsi\nKdyž chceš změnit roli nebo kategorii, napiš správcům přes ticket v <#777>\./
    )
})

test("Podat přihlášku opens window 1 directly (L6-14, L6-18)", async (t) => {
    backend(t, [state()])
    const { value, modals } = interaction({ customId: "membership:apply" })
    await handleApplicationStart(value as unknown as ButtonInteraction)
    const modal = JSON.parse(
        JSON.stringify((modals[0] as { toJSON(): unknown }).toJSON())
    ) as { custom_id: string; title: string }
    assert.equal(modal.custom_id, "application-window:new:about")
    assert.equal(modal.title, "Přihláška · 1 ze 3 · O tobě")
})

const savedAbout: ApplicationAnswers = {
    games: ["hell_let_loose"],
    categoryId: "main",
    inGameName: "Hráč 17",
    accounts: {},
    answers: { source: ["source-1"], age: ["24"] },
    completedWindows: ["about"],
}

test("window 1 is saved and the progress message shows step 2 (L6-24..26, L6-B03)", async (t) => {
    const writes = backend(
        t,
        [
            state(),
            state({
                draft: {
                    id: "draft1",
                    answers: savedAbout,
                    source: "discord",
                    submissionStatus: null,
                    submissionError: null,
                },
            }),
        ],
        {
            "membershipApplications:saveApplicationWindow": {
                ok: true,
                draftId: "draft1",
                answers: savedAbout,
            },
        }
    )
    const { value, replies } = interaction({
        customId: "application-window:new:about",
        fields: {
            games: { values: ["hell_let_loose"] },
            category: { values: ["main"] },
            name: { value: "Hráč 17" },
            "q-source": { values: ["source-1"] },
            "q-age": { value: "24" },
        },
    })
    await handleWindowModal(value as unknown as ModalSubmitInteraction)
    assert.equal(
        writes[0]!.name,
        "membershipApplications:saveApplicationWindow"
    )
    assert.deepEqual(writes[0]!.args.values, {
        games: ["hell_let_loose"],
        category: ["main"],
        name: ["Hráč 17"],
        "q-source": ["source-1"],
        "q-age": ["24"],
    })
    assert.equal(writes[0]!.args.windowId, "about")
    const text = texts(replies[0])
    assert.match(text, /PŘIHLÁŠKA DO KLANU VLCI · KROK 2 ZE 3/)
    assert.match(text, /### Herní účty/)
    assert.match(
        text,
        /Hell Let Loose · Člen · Hráč 17 · od kamaráda z klanu · 24 let/
    )
})

test("a bad Steam ID comes back as 'Oprav herní účty' (L6-54)", async (t) => {
    const draft = {
        id: "draft1",
        answers: savedAbout,
        source: "discord" as const,
        submissionStatus: null,
        submissionError: null,
    }
    backend(t, [state({ draft })], {
        "membershipApplications:saveApplicationWindow": {
            ok: false,
            reason: "invalid",
            issues: [{ fieldId: "steam", issue: "steam" }],
        },
    })
    const { value, replies } = interaction({
        customId: "application-window:draft1:accounts",
        ephemeralMessage: true,
        fields: { steam: { value: "123" } },
    })
    await handleWindowModal(value as unknown as ModalSubmitInteraction)
    const text = texts(replies[0])
    assert.match(text, /### Oprav herní účty/)
    assert.match(
        text,
        /Steam ID nevypadá správně\. Má 17 číslic a začíná 7656119\./
    )
})

test("Zrušit discards the draft (L4-24)", async (t) => {
    const writes = backend(t, [
        state({
            draft: {
                id: "draft1",
                answers: savedAbout,
                source: "discord",
                submissionStatus: null,
                submissionError: null,
            },
        }),
    ])
    const { value, replies } = interaction({
        customId: "application:draft1:cancel",
        ephemeralMessage: true,
    })
    await handleApplicationButton(value as unknown as ButtonInteraction)
    assert.deepEqual(
        writes.map((write) => write.name),
        ["membershipApplications:discardApplicationDraft"]
    )
    assert.match(
        texts(replies[0]),
        /### Přihláška zrušena\nNic se neodeslalo\. Novou začneš tlačítkem Podat přihlášku v <#555>\./
    )
})

test("an expired draft says to start again (L4-25)", async (t) => {
    backend(t, [state()])
    const { value, replies } = interaction({
        customId: "application:gone:open:accounts",
        ephemeralMessage: true,
    })
    await handleApplicationButton(value as unknown as ButtonInteraction)
    assert.match(texts(replies[0]), /### Tenhle průvodce už vypršel/)
})

test("Odeslat přihlášku creates the thread, the intro and the card (L6-41..46, L6-B04)", async (t) => {
    const complete: ApplicationAnswers = {
        ...savedAbout,
        accounts: { steam: "76561198000000017" },
        answers: {
            ...savedAbout.answers,
            specialization: ["spec-1"],
            hours: ["10–15 hodin"],
            why: ["Hraju rád."],
            when: ["when-1"],
            microphone: ["yes"],
        },
        completedWindows: ["about", "accounts", "q1", "q2"],
    }
    const writes = backend(
        t,
        [
            state({
                draft: {
                    id: "draft1",
                    answers: complete,
                    source: "discord",
                    submissionStatus: null,
                    submissionError: null,
                },
            }),
        ],
        {
            "membershipApplications:claimApplicationSubmission": {
                ok: true,
                submission: {
                    draftId: "draft1",
                    source: "discord",
                    config: {
                        guildId: "123456789012345678",
                        defaultLanguage: "cs",
                        timezone: "Europe/Prague",
                        membershipSettings: {
                            enabled: true,
                            applicationParentChannelId: "666",
                            inviteSupportMembersIndividually: false,
                            sendConfirmationDm: false,
                            panelTitle: "",
                            panelDescription: "",
                            autoAssignRecruitOnApply: false,
                            categories,
                        },
                    },
                    clanName: "Vlci",
                    guildRecordId: "guild-record",
                    category: categories[0],
                    games: ["hell_let_loose"],
                    inGameName: "Hráč 17",
                    accounts: {
                        steam: "76561198000000017",
                        steamVerified: false,
                    },
                    answers: [
                        {
                            questionId: "source",
                            kind: "source",
                            label: "Odkud o nás víš?",
                            value: "Od kamaráda z klanu",
                        },
                    ],
                    initialStatus: "pending",
                },
            },
            "userAssignments:upsertByServerDiscordId": "assignment-1",
            "discordMembership:createMembershipApplicationThread": {
                application: { applicationNumber: 42 },
            },
        }
    )
    const posts: unknown[] = []
    const thread = {
        id: "999",
        send: async (payload: unknown) => {
            posts.push(payload)
            return { id: `message-${posts.length}` }
        },
        members: { add: async () => {} },
        delete: async () => {},
    }
    const { value, replies } = interaction({
        customId: "application:draft1:submit",
        ephemeralMessage: true,
        guild: {
            client: {},
            channels: {
                fetch: async () => ({
                    type: ChannelType.GuildText,
                    threads: {
                        create: async (options: { name: string }) => {
                            assert.equal(options.name, "přihláška-hráč-17")
                            return thread
                        },
                    },
                }),
            },
            members: { fetch: async () => null, cache: new Map() },
        },
    })
    await handleApplicationButton(value as unknown as ButtonInteraction)
    assert.deepEqual(
        writes.map((write) => write.name),
        [
            "membershipApplications:claimApplicationSubmission",
            "userAssignments:upsertByServerDiscordId",
            "discordMembership:createMembershipApplicationThread",
            "discordMembership:updateMembershipApplicationTranscriptMessage",
            "players:linkDiscordPlatformId",
        ]
    )
    const intro = posts[0] as {
        content: string
        allowedMentions: { users: string[]; roles: string[] }
    }
    assert.equal(
        intro.content,
        `<@${userId}> <@&recruiters>\nAhoj <@${userId}>, díky za přihlášku. <@&recruiters> se ti brzy ozve.`
    )
    assert.deepEqual(intro.allowedMentions, {
        users: [userId],
        roles: ["recruiters"],
    })
    const card = texts(posts[1])
    assert.match(card, /PŘIHLÁŠKA #42 · HELL LET LOOSE/)
    assert.match(card, /### Hráč 17 · Člen/)
    assert.match(
        JSON.stringify(
            (
                posts[1] as { components: { toJSON(): unknown }[] }
            ).components[0]!.toJSON()
        ),
        /"label":"Přijmout jako člena"/
    )
    assert.match(
        texts(replies.at(-1)),
        /### Přihláška odeslána\nNábor se ti ozve ve vlákně <#999>\. Rozhodnutí ti přijde i do DM\./
    )
})
