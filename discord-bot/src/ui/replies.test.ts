import test, { afterEach } from "node:test"
import assert from "node:assert/strict"

import { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"
import { MessageFlags } from "discord.js"

import {
    editManagedMessage,
    interactionLanguage,
    replyAdminFixableError,
    replyError,
    replyPrivately,
    replyUnknownError,
    reportToErrorsChannel,
    type ErrorsChannelReporter,
    type PrivateReplyTarget,
} from "./replies"
import {
    errorCard,
    notAllowedCard,
    wrongPlaceCard,
} from "../../../src/domain/discord-messages/message-view"
import { closeConvexClient } from "../convex"

afterEach(closeConvexClient)

type Call = { method: string; payload?: Record<string, unknown> }
function fakeInteraction(
    state: { deferred?: boolean; replied?: boolean; ephemeral?: boolean } = {}
) {
    const calls: Call[] = []
    const record = (method: string) => async (payload?: unknown) => {
        calls.push({ method, payload: payload as Record<string, unknown> })
    }
    const interaction: PrivateReplyTarget & {
        guildId: string | null
        client: undefined
    } = {
        deferred: state.deferred ?? false,
        replied: state.replied ?? false,
        ephemeral: state.ephemeral ?? null,
        reply: record("reply"),
        editReply: record("editReply"),
        followUp: record("followUp"),
        deleteReply: record("deleteReply"),
        guildId: "123456789012345678",
        client: undefined,
    }
    return { interaction, calls }
}
const text = (payload: Record<string, unknown> | undefined) =>
    JSON.stringify(payload?.components)
const card = errorCard({
    title: "Tento ticket můžou zavřít jen podpora a správci",
    body: "Když je vyřešený, napiš to sem do vlákna.",
})
const privateV2 = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral

test("a fresh interaction gets a private Components V2 reply", async () => {
    const { interaction, calls } = fakeInteraction()
    await replyPrivately(interaction, { ...card, ephemeral: false })
    assert.deepEqual(
        calls.map((call) => call.method),
        ["reply"]
    )
    assert.equal(calls[0]!.payload!.flags, privateV2)
    assert.match(text(calls[0]!.payload), /Tento ticket můžou zavřít/)
})

test("a private deferral is completed in place", async () => {
    const { interaction, calls } = fakeInteraction({
        deferred: true,
        ephemeral: true,
    })
    await replyPrivately(interaction, card, { language: "cs" })
    assert.deepEqual(
        calls.map((call) => call.method),
        ["editReply"]
    )
    assert.equal(calls[0]!.payload!.flags, MessageFlags.IsComponentsV2)
    assert.equal(calls[0]!.payload!.content, null)
})

test("a public deferral is removed so the card never shows to the channel", async () => {
    const { interaction, calls } = fakeInteraction({
        deferred: true,
        ephemeral: false,
    })
    await replyPrivately(interaction, card)
    assert.deepEqual(
        calls.map((call) => call.method),
        ["deleteReply", "followUp"]
    )
    assert.equal(calls[1]!.payload!.flags, privateV2)
})

test("after an earlier reply the card is a private follow-up", async () => {
    const { interaction, calls } = fakeInteraction({
        replied: true,
        deferred: true,
    })
    await replyPrivately(interaction, card)
    assert.deepEqual(
        calls.map((call) => call.method),
        ["followUp"]
    )
    assert.equal(calls[0]!.payload!.flags, privateV2)
})

test("not allowed and wrong place errors reply without reporting", async () => {
    const reports: unknown[] = []
    const reporter: ErrorsChannelReporter = async (input) => {
        reports.push(input)
    }
    for (const view of [
        notAllowedCard({
            title: "O této přihlášce rozhoduje nábor",
            whoMay: "Přihlášky kategorie Hlavní člen vyřizuje <@&1> nebo správci Logi.",
        }),
        wrongPlaceCard({
            title: "/close_application funguje jen ve vlákně přihlášky",
            whereItWorks: "Otevři vlákno přihlášky a spusť příkaz tam.",
        }),
    ]) {
        const { interaction, calls } = fakeInteraction()
        await replyError(interaction, view, { language: "cs", reporter })
        assert.equal(calls[0]!.payload!.flags, privateV2)
    }
    assert.deepEqual(reports, [])
})

test("an admin-fixable error tells the person admins were notified and reports the cause", async () => {
    const reports: Parameters<ErrorsChannelReporter>[0][] = []
    const reporter: ErrorsChannelReporter = async (input) => {
        reports.push(input)
    }
    const { interaction, calls } = fakeInteraction()
    const failure = new Error("Missing Permissions")
    await replyAdminFixableError(
        interaction,
        {
            title: "Hlášení teď nejde poslat",
            report: {
                error: failure,
                action: "Create a report thread",
                location: "Player reports",
                scope: "interaction",
            },
        },
        { language: "cs", reporter }
    )
    const sent = text(calls[0]!.payload)
    assert.match(sent, /### Hlášení teď nejde poslat/)
    assert.match(sent, /Správci dostali upozornění\./)
    assert.doesNotMatch(sent, /Missing Permissions/)
    assert.equal(reports.length, 1)
    assert.equal(reports[0]!.guildId, "123456789012345678")
    assert.equal(reports[0]!.error, failure)
    assert.equal(reports[0]!.action, "Create a report thread")
})

test("a failing errors channel never breaks the reply and DMs report nothing", async () => {
    await reportToErrorsChannel(
        {
            guildId: "1",
            error: new Error("x"),
            action: "a",
            location: "b",
            scope: "c",
        },
        async () => {
            throw new Error("errors channel down")
        }
    )
    let called = false
    await reportToErrorsChannel(
        { guildId: null, error: 1, action: "a", location: "b", scope: "c" },
        async () => {
            called = true
        }
    )
    assert.equal(called, false)
})

test("the unknown error card replaces the English generic error in every language", async () => {
    const expected = {
        cs: /Tohle se nepovedlo.*Zkus to za chvíli znovu\. Když to nepůjde, napiš správcům klanu\./,
        en: /That didn't work.*Try again in a moment/,
        de: /Das hat nicht geklappt.*Versuch es gleich noch einmal/,
    }
    for (const [language, pattern] of Object.entries(expected)) {
        const { interaction, calls } = fakeInteraction()
        await replyUnknownError(interaction, { language })
        assert.match(text(calls[0]!.payload), pattern)
        assert.doesNotMatch(
            text(calls[0]!.payload),
            /Something went wrong while handling that interaction/
        )
        assert.equal(calls[0]!.payload!.flags, privateV2)
        assert.equal(calls[0]!.payload!.ephemeral, undefined)
    }
})

test("a managed message is edited in place into the card", async () => {
    const edits: Record<string, unknown>[] = []
    await editManagedMessage(
        {
            edit: async (payload) => {
                edits.push(payload as Record<string, unknown>)
            },
        },
        card
    )
    assert.equal(edits.length, 1)
    assert.equal(edits[0]!.content, null)
    assert.deepEqual(edits[0]!.embeds, [])
    assert.equal(edits[0]!.flags, MessageFlags.IsComponentsV2)
})

test("the reply language is the clan language, read once and bounded in time", async (t) => {
    const requests: string[] = []
    t.mock.method(
        ConvexReactClient.prototype,
        "query",
        async (reference: Parameters<typeof getFunctionName>[0]) => {
            requests.push(getFunctionName(reference))
            return { defaultLanguage: "de" }
        }
    )
    assert.equal(await interactionLanguage(null), undefined)
    assert.equal(await interactionLanguage("900000000000000001"), "de")
    assert.equal(await interactionLanguage("900000000000000001"), "de")
    assert.deepEqual(requests, ["discordConfig:getConfigByDiscordGuildId"])
})

test("a slow backend does not hold the reply past the timeout", async (t) => {
    t.mock.method(
        ConvexReactClient.prototype,
        "query",
        () => new Promise(() => undefined)
    )
    const started = Date.now()
    assert.equal(await interactionLanguage("900000000000000002", 20), undefined)
    assert.ok(Date.now() - started < 1_000)
})
