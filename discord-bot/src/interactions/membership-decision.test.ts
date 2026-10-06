import test, { afterEach, type TestContext } from "node:test"
import assert from "node:assert/strict"

import type { ButtonInteraction, ChatInputCommandInteraction } from "discord.js"
import { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"

import {
    handleCloseApplicationCommand,
    handleDecisionButton,
} from "./membership-decision"
import { closeConvexClient } from "../convex"

afterEach(closeConvexClient)

const actorId = "222222222222222222"
const applicantId = "333333333333333333"
let nextGuild = 0
const newGuildId = () => `8100000000000${String(nextGuild++).padStart(5, "0")}`

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
    input: {
        guildId: string
        status?: "open" | "closed"
        transcriptMessageId?: string
        /** "DM po rozhodnutí o přihlášce" (N1-39); missing is on. */
        decisionDm?: boolean
    }
) {
    const writes: Array<{ name: string; args: Record<string, unknown> }> = []
    t.mock.method(
        ConvexReactClient.prototype,
        "query",
        async (reference: Parameters<typeof getFunctionName>[0]) => {
            const name = getFunctionName(reference)
            if (name === "discordConfig:getConfigByDiscordGuildId")
                return { defaultLanguage: "cs" }
            if (
                name ===
                "discordMembership:getMembershipApplicationThreadContext"
            )
                return {
                    config: {
                        guildId: input.guildId,
                        defaultLanguage: "cs",
                        timezone: "Europe/Prague",
                        dashboardAdminRoleId: "logi-admin",
                        clanRoleId: "clan",
                        membershipSettings: { enabled: true },
                        ...(input.decisionDm === false
                            ? { applicationCloseDmEnabled: false }
                            : {}),
                    },
                    application: {
                        threadId: "444444444444444444",
                        status: input.status ?? "open",
                        creatorId: applicantId,
                        applicationNumber: 42,
                        categoryId: "main",
                        categoryLabel: "Člen",
                        gameId: "hell_let_loose",
                        assignmentId: "assignment-1",
                        assignmentType: "member",
                        answers: [],
                        openedAt: "2026-10-11T18:14:00.000Z",
                        applicantName: "Hráč 17",
                        closedByUserId:
                            input.status === "closed" ? actorId : undefined,
                        closeOutcome:
                            input.status === "closed" ? "member" : undefined,
                        transcriptMessageId: input.transcriptMessageId,
                    },
                    assignment: {
                        type: "member",
                        status: "pending",
                        membershipCategoryId: "main",
                    },
                    category: {
                        id: "main",
                        label: "Člen",
                        supportRoleIds: ["recruiters"],
                        recruitRoleIds: ["recruit"],
                        finalRoleIds: ["member"],
                        assignmentType: "member",
                    },
                    clanName: "Vlci",
                    guildRecordId: "guild-record",
                    ticketChannelId: null,
                }
            return null
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
            if (name === "membershipApplications:claimApplicationDecision")
                return { ok: true }
            if (name === "userAssignments:upsertByServerDiscordId")
                return "assignment-1"
            return { ok: true }
        }
    )
    return writes
}

function discord(input: {
    guildId: string
    roles: string[]
    inThread?: boolean
    dmFails?: boolean
}) {
    const sent: unknown[] = []
    const dms: unknown[] = []
    const replies: unknown[] = []
    const calls: string[] = []
    const noop = async () => {}
    const guild = {
        id: input.guildId,
        name: "Vlci",
        fetch: async () => {
            calls.push("guild")
            return guild
        },
        roles: {
            fetch: async () => {
                calls.push("roles")
            },
            cache: new Map([
                ["clan", { name: "Klan" }],
                ["member", { name: "Člen" }],
            ]),
        },
        members: {
            fetch: async () => {
                calls.push("member")
                return {
                    permissions: { has: () => false },
                    roles: {
                        cache: new Map(input.roles.map((id) => [id, {}])),
                    },
                }
            },
        },
        channels: { cache: new Map() },
        client: {
            user: { id: "bot" },
            users: {
                fetch: async () => ({
                    send: async (payload: unknown) => {
                        if (input.dmFails) throw new Error("Cannot send")
                        dms.push(payload)
                    },
                }),
            },
        },
    }
    const thread = {
        id: "444444444444444444",
        name: "přihláška-hráč-17",
        isThread: () => input.inThread ?? true,
        send: async (payload: unknown) => {
            sent.push(payload)
        },
        setName: async (name: string) => {
            calls.push(`name:${name}`)
        },
        setLocked: async () => {
            calls.push("locked")
        },
        setArchived: async () => {
            calls.push("archived")
        },
        messages: { fetch: async () => null },
    }
    const base = {
        guildId: input.guildId,
        guild,
        channel: thread,
        channelId: thread.id,
        client: guild.client,
        user: { id: actorId, username: "hrac02", globalName: "Hráč 02" },
        member: { displayName: "Hráč 02" },
        deferred: false,
        replied: false,
        ephemeral: null,
        deferReply: async () => {
            base.deferred = true
            base.ephemeral = true as never
        },
        deferUpdate: async () => {
            base.deferred = true
        },
        reply: async (payload: unknown) => {
            base.replied = true
            replies.push(payload)
        },
        editReply: async (payload: unknown) => {
            replies.push(payload)
        },
        followUp: async (payload: unknown) => {
            replies.push(payload)
        },
        update: async (payload: unknown) => {
            replies.push(payload)
        },
        deleteReply: noop,
        showModal: async (modal: unknown) => {
            replies.push(modal)
        },
    }
    return { base, sent, dms, replies, calls }
}

test("/close_application outside an application thread says where it works (M3-42)", async (t) => {
    const guildId = newGuildId()
    backend(t, { guildId })
    const { base, replies } = discord({ guildId, roles: [], inThread: false })
    await handleCloseApplicationCommand({
        ...base,
        options: { getString: () => "member" },
    } as unknown as ChatInputCommandInteraction)
    assert.match(
        texts(replies[0]),
        /### \/close\\_application funguje jen ve vlákně přihlášky\nOtevři vlákno přihlášky a spusť příkaz tam\./
    )
})

test("/close_application checks roles freshly and says who decides (M3-41, M3-B05)", async (t) => {
    const guildId = newGuildId()
    const writes = backend(t, { guildId })
    const { base, replies, calls } = discord({ guildId, roles: ["someone"] })
    await handleCloseApplicationCommand({
        ...base,
        options: { getString: () => "member" },
    } as unknown as ChatInputCommandInteraction)
    assert.deepEqual(calls, ["guild", "roles", "member"])
    assert.deepEqual(writes, [])
    assert.match(
        texts(replies[0]),
        /### O této přihlášce rozhoduje nábor\nPřihlášky kategorie Člen vyřizuje <@&recruiters> nebo správci Logi\./
    )
})

test("/close_application by a recruiter writes the membership, closes and DMs (M3-37, M3-39, M3-B07)", async (t) => {
    const guildId = newGuildId()
    const writes = backend(t, { guildId })
    const { base, replies, dms, sent, calls } = discord({
        guildId,
        roles: ["recruiters"],
    })
    await handleCloseApplicationCommand({
        ...base,
        options: {
            getString: (name: string) =>
                name === "outcome" ? "member" : "Pohovor proběhl.",
        },
    } as unknown as ChatInputCommandInteraction)
    assert.deepEqual(
        writes.map((write) => write.name),
        [
            "membershipApplications:claimApplicationDecision",
            "userAssignments:upsertByServerDiscordId",
            "discordMembership:closeMembershipApplicationThread",
        ]
    )
    assert.equal(writes[1]!.args.status, "active")
    assert.equal(writes[2]!.args.closeOutcome, "member")
    // Older threads without a card get the decision as a new message.
    assert.match(texts(sent[0]), /PŘIHLÁŠKA #42 · UZAVŘENA/)
    assert.match(
        texts(sent[0]),
        /Role <@&clan> a <@&member> přidá Logi do minuty\./
    )
    const dm = texts(dms[0])
    assert.match(dm, /### Vítej v klanu, jsi Člen/)
    assert.match(dm, /Role Klan a Člen dostaneš na serveru během minuty\./)
    assert.match(dm, /> Pohovor proběhl\./)
    assert.doesNotMatch(dm, /<@&/)
    // The footer opens "Zprávy od bota" on the account page (L2-05).
    assert.match(
        dm,
        /\[Nastavit zprávy\]\(https?:\/\/[^)]+\/cs\/dashboard\/settings\/user#zpravy-od-bota\)/
    )
    assert.ok(calls.includes("locked") && calls.includes("archived"))
    assert.ok(calls.includes("name:uzavřeno · přihláška-hráč-17"))
    assert.match(
        texts(replies.at(-1)),
        /### Přihláška #42 uzavřena: Člen\nHráč 17 dostane role Klan a Člen do minuty\. Rozhodnutí je ve vlákně a uchazeč ho dostal do DM\./
    )
})

test("an undeliverable DM is reported in the reply (L4-34)", async (t) => {
    const guildId = newGuildId()
    backend(t, { guildId })
    const { base, replies } = discord({
        guildId,
        roles: ["logi-admin"],
        dmFails: true,
    })
    await handleCloseApplicationCommand({
        ...base,
        options: {
            getString: (name: string) => (name === "outcome" ? "denied" : null),
        },
    } as unknown as ChatInputCommandInteraction)
    assert.match(
        texts(replies.at(-1)),
        /### Přihláška #42 zamítnuta\nRozhodnutí je ve vlákně\. Uchazeči nejde poslat DM, najde ho tam\./
    )
})

test("a decided application answers with who decided (L6-59, M3-43)", async (t) => {
    const guildId = newGuildId()
    const writes = backend(t, { guildId, status: "closed" })
    const { base, replies } = discord({ guildId, roles: ["recruiters"] })
    await handleDecisionButton({
        ...base,
        customId: "application-decision:member",
    } as unknown as ButtonInteraction)
    assert.deepEqual(writes, [])
    const text = texts(replies[0])
    assert.match(text, /### O přihlášce #42 už je rozhodnuto/)
    assert.match(
        text,
        /Rozhodl <@222222222222222222>: Člen\. Členství změníš na webu v Členové\./
    )
})

test("a decision button pressed by someone else is refused privately (L6-58)", async (t) => {
    const guildId = newGuildId()
    const writes = backend(t, { guildId })
    const { base, replies } = discord({ guildId, roles: [] })
    await handleDecisionButton({
        ...base,
        customId: "application-decision:member",
    } as unknown as ButtonInteraction)
    assert.deepEqual(writes, [])
    assert.match(texts(replies[0]), /### O přihlášce rozhoduje nábor/)
})

test("Zamítnout… opens the reason window (L6-47)", async (t) => {
    const guildId = newGuildId()
    backend(t, { guildId })
    const { base, replies } = discord({ guildId, roles: ["recruiters"] })
    await handleDecisionButton({
        ...base,
        customId: "application-decision:reject",
    } as unknown as ButtonInteraction)
    const modal = JSON.parse(
        JSON.stringify((replies[0] as { toJSON(): unknown }).toJSON())
    ) as { title: string; components: Json[] }
    assert.equal(modal.title, "Zamítnout přihlášku #42")
    assert.equal(
        modal.components[0]!.content,
        "Hráč 17 dostane důvod do DM. Vlákno se pak zamkne a archivuje."
    )
    assert.equal(modal.components[1]!.label, "Důvod")
    assert.equal(modal.components[1]!.description, "Uvidí ho uchazeč.")
    assert.equal(
        (modal.components[1]!.component as Json).placeholder,
        "Např. teď nenabíráme do zálohy, zkus to v listopadu."
    )
})

test("Ještě nerozhodnuto records who and keeps the buttons (L6-49)", async (t) => {
    const guildId = newGuildId()
    t.mock.method(Date.prototype, "toISOString", function (this: Date) {
        return "2026-10-11T19:05:00.000Z"
    })
    const writes = backend(t, { guildId })
    t.mock.method(
        ConvexReactClient.prototype,
        "mutation",
        async (reference: Parameters<typeof getFunctionName>[0]) => {
            writes.push({ name: getFunctionName(reference), args: {} })
            return { ok: true, at: "2026-10-11T19:05:00.000Z" }
        }
    )
    const { base, replies } = discord({ guildId, roles: ["recruiters"] })
    await handleDecisionButton({
        ...base,
        customId: "application-decision:undecided",
    } as unknown as ButtonInteraction)
    assert.deepEqual(
        writes.map((write) => write.name),
        ["membershipApplications:markApplicationUndecided"]
    )
    const text = texts(replies[0])
    assert.match(text, /Ještě nerozhodnuto · Hráč 02, 21:05/)
    assert.match(text, /Vlákno zůstává otevřené, uchazeč nic nedostane\./)
})

test("decision DMs switched off in Zprávy a panely are not sent (N1-39)", async (t) => {
    const guildId = newGuildId()
    backend(t, { guildId, decisionDm: false })
    const { base, replies, dms } = discord({
        guildId,
        roles: ["recruiters"],
    })
    await handleCloseApplicationCommand({
        ...base,
        options: {
            getString: (name: string) => (name === "outcome" ? "member" : null),
        },
    } as unknown as ChatInputCommandInteraction)
    assert.deepEqual(dms, [])
    assert.match(
        texts(replies.at(-1)),
        /DM o rozhodnutí má klan v nastavení zpráv vypnuté\./
    )
})
