import {
    MessageFlags,
    ModalBuilder,
    type ButtonInteraction,
    type AutocompleteInteraction,
    type InteractionReplyOptions,
} from "discord.js"
import {
    protectInteraction,
    handlePreparedModalButton,
    PreparedModalExpired,
} from "./acknowledgement"
import { errorCard } from "../../../src/domain/discord-messages/message-view"
import test, { afterEach, type TestContext } from "node:test"
import { replyPrivately } from "../ui/replies"
import { closeConvexClient } from "../convex"
import { runInteraction } from "./registry"
afterEach(closeConvexClient)
import assert from "node:assert/strict"

function fixture(
    kind: "command" | "component" | "modal" | "autocomplete" = "component"
) {
    const calls: Array<{ method: string; options?: unknown }> = []
    let initialCalls = 0
    let modalClick: ButtonInteraction | undefined
    let rejectCollector = false
    let collectorFilter: ((click: ButtonInteraction) => boolean) | undefined
    let nextId = 0
    const message = (id: string) => ({
        id,
        awaitMessageComponent: async (options: {
            filter: (click: ButtonInteraction) => boolean
        }) => {
            collectorFilter = options.filter
            if (rejectCollector) throw new Error("collector timeout")
            assert.ok(modalClick)
            assert.equal(options.filter(modalClick), true)
            return modalClick
        },
    })
    function captureModal(options: unknown) {
        const payload = options as {
            components?: Array<{
                toJSON(): { components: Array<{ custom_id?: string }> }
            }>
        }
        const customId =
            payload.components?.[0]?.toJSON().components[0]?.custom_id
        if (customId)
            modalClick = {
                customId,
                user: { id: "user" },
                showModal: async (modal: unknown) => {
                    calls.push({ method: "freshModal", options: modal })
                },
            } as unknown as ButtonInteraction
    }
    const original = {
        id: "interaction-1",
        guildId: "guild",
        user: { id: "user" },
        deferred: false,
        replied: false,
        ephemeral: null as boolean | null,
        isRepliable: () => kind !== "autocomplete",
        isAutocomplete: () => kind === "autocomplete",
        isMessageComponent: () => kind === "component",
        isModalSubmit: () => kind === "modal",
        isFromMessage: () => kind === "modal",
        message: { id: "shared-message", flags: { has: () => false } },
        async deferReply(options: InteractionReplyOptions) {
            assert.equal(++initialCalls, 1)
            calls.push({ method: "deferReply", options })
            original.deferred = true
        },
        async deferUpdate() {
            assert.equal(++initialCalls, 1)
            calls.push({ method: "deferUpdate" })
            original.deferred = true
        },
        async reply(options: unknown) {
            assert.equal(++initialCalls, 1)
            calls.push({ method: "reply", options })
            original.replied = true
        },
        async update(options: unknown) {
            assert.equal(++initialCalls, 1)
            calls.push({ method: "update", options })
            original.replied = true
        },
        async showModal(options: unknown) {
            assert.equal(++initialCalls, 1)
            calls.push({ method: "showModal", options })
            original.replied = true
        },
        async editReply(options: unknown) {
            calls.push({ method: "editReply", options })
            original.replied = true
            captureModal(options)
            return message("@original")
        },
        async followUp(options: unknown) {
            calls.push({ method: "followUp", options })
            original.replied = true
            captureModal(options)
            return message(`reply-${++nextId}`)
        },
        async deleteReply() {
            calls.push({ method: "deleteReply" })
        },
        async respond(options: unknown) {
            assert.equal(++initialCalls, 1)
            calls.push({ method: "respond", options })
        },
        webhook: {
            async editMessage(id: string, options: unknown) {
                calls.push({ method: `edit:${id}`, options })
                return message(id)
            },
            async deleteMessage(id: string) {
                calls.push({ method: `delete:${id}` })
            },
        },
    }
    return {
        original,
        calls,
        source: original as unknown as ButtonInteraction,
        expire: () => {
            rejectCollector = true
        },
        filter: () => collectorFilter,
        click: () => modalClick,
    }
}

function slow(t: TestContext, kind?: Parameters<typeof fixture>[0]) {
    t.mock.timers.enable({ apis: ["setTimeout"] })
    const f = fixture(kind)
    const guarded = protectInteraction(f.source)
    t.mock.timers.tick(1_000)
    return { ...f, ...guarded }
}

test("fast replies and modals keep their native response and cancel the watchdog", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] })
    for (const action of ["reply", "showModal"] as const) {
        const f = fixture()
        const guarded = protectInteraction(f.source)
        if (action === "reply")
            await guarded.interaction.reply({ content: "done" })
        else await guarded.interaction.showModal(new ModalBuilder())
        t.mock.timers.tick(2_000)
        await guarded.finish()
        assert.deepEqual(
            f.calls.map((c) => c.method),
            [action]
        )
    }
})

test("slow public components receive private replies without editing their source", async (t) => {
    const f = slow(t)
    assert.equal(
        f.interaction.deferred,
        false,
        "fallback must not change handler routing"
    )
    await f.interaction.reply({
        content: "private data",
        flags: MessageFlags.Ephemeral,
    })
    await f.finish()
    assert.deepEqual(
        f.calls.map((c) => c.method),
        ["deferUpdate", "followUp"]
    )
    assert.equal(f.interaction.replied, true)
})

for (const kind of ["component", "modal"] as const) {
    test(`slow ${kind} update edits the source once`, async (t) => {
        const f = slow(t, kind)
        await f.interaction.update({ content: "updated card" })
        await f.finish()
        assert.deepEqual(
            f.calls.map((c) => c.method),
            ["deferUpdate", "editReply"]
        )
    })
}

test("late explicit deferReply creates a private response and edits that response", async (t) => {
    const f = slow(t)
    await f.interaction.deferReply({ flags: MessageFlags.Ephemeral })
    assert.equal(f.interaction.deferred, true)
    await f.interaction.editReply({ content: "done" })
    await f.finish()
    assert.deepEqual(
        f.calls.map((c) => c.method),
        ["deferUpdate", "followUp", "edit:reply-1"]
    )
})

test("a follow-up after late deferReply completes the waiting reply", async (t) => {
    const f = slow(t)
    await f.interaction.deferReply({ flags: MessageFlags.Ephemeral })
    await f.interaction.followUp({
        components: [],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    })
    await f.finish()
    assert.deepEqual(
        f.calls.map((c) => c.method),
        ["deferUpdate", "followUp", "edit:reply-1"]
    )
    assert.equal(
        (f.calls.at(-1)?.options as { content: unknown }).content,
        null
    )
})

test("late deferUpdate and private error handling never delete a public card", async (t) => {
    const f = slow(t)
    await f.interaction.deferUpdate()
    await replyPrivately(
        f.interaction,
        errorCard({ title: "Failed", body: "Try again" })
    )
    await f.finish()
    assert.deepEqual(
        f.calls.map((c) => c.method),
        ["deferUpdate", "followUp"]
    )
})

test("slow commands complete private deferrals in place, retaining Components V2 flags", async (t) => {
    const f = slow(t, "command")
    await f.interaction.reply({
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        components: [],
    })
    await f.finish()
    assert.deepEqual(
        f.calls.map((c) => c.method),
        ["deferReply", "editReply"]
    )
    assert.equal(
        (f.calls[1].options as { flags: number }).flags,
        MessageFlags.IsComponentsV2
    )
})

test("slow commands preserve intentionally public responses", async (t) => {
    const f = slow(t, "command")
    await f.interaction.reply({ content: "public" })
    await f.finish()
    assert.deepEqual(
        f.calls.map((c) => c.method),
        ["deferReply", "deleteReply", "followUp"]
    )
})

test("slow autocomplete answers empty once and discards late results", async (t) => {
    const f = slow(t, "autocomplete")
    const interaction = f.interaction as unknown as AutocompleteInteraction
    await interaction.respond([{ name: "late", value: "late" }])
    await f.finish()
    assert.deepEqual(f.calls, [{ method: "respond", options: [] }])
})

test("slow modal preparation uses an owner-only fresh click and consumes it once", async (t) => {
    const f = slow(t)
    const modal = new ModalBuilder()
        .setCustomId("original-form")
        .setTitle("Form")
    await f.interaction.showModal(modal)
    await f.finish()
    assert.deepEqual(
        f.calls.map((c) => c.method),
        ["deferUpdate", "followUp", "freshModal", "edit:reply-1"]
    )
    assert.equal(f.calls[2].options, modal)
    assert.equal(
        f.filter()?.(f.click()!),
        false,
        "a consumed continuation cannot open twice"
    )
    assert.equal(
        f.filter()?.({
            ...f.click(),
            user: { id: "other" },
        } as ButtonInteraction),
        false
    )
})

test("expired prepared forms clear their button and stop the original handler", async (t) => {
    const f = slow(t)
    f.expire()
    await assert.rejects(
        f.interaction.showModal(new ModalBuilder()),
        PreparedModalExpired
    )
    await f.finish()
    assert.equal(f.calls.at(-1)?.method, "edit:reply-1")
    const replies: unknown[] = []
    await handlePreparedModalButton({
        ...f.click(),
        guildId: null,
        reply: async (value: unknown) => {
            replies.push(value)
        },
    } as unknown as ButtonInteraction)
    assert.equal(replies.length, 1)
})

test("a reply racing an in-flight fallback waits and never acknowledges twice", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] })
    const f = fixture()
    let complete: (() => void) | undefined
    f.original.deferUpdate = async () => {
        await new Promise<void>((resolve) => {
            complete = resolve
        })
        f.calls.push({ method: "deferUpdate" })
    }
    const guarded = protectInteraction(f.source)
    t.mock.timers.tick(1_000)
    const reply = guarded.interaction.reply({
        content: "done",
        flags: MessageFlags.Ephemeral,
    })
    assert.equal(f.calls.length, 0)
    complete?.()
    await reply
    await guarded.finish()
    assert.deepEqual(
        f.calls.map((c) => c.method),
        ["deferUpdate", "followUp"]
    )
})

test("failed automatic acknowledgement is observed without an unhandled rejection", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] })
    const f = fixture()
    f.original.deferUpdate = async () => {
        throw new Error("Discord unavailable")
    }
    const guarded = protectInteraction(f.source)
    t.mock.timers.tick(1_000)
    await assert.rejects(
        guarded.interaction.reply({ content: "done" }),
        /Discord unavailable/
    )
    await assert.rejects(guarded.finish(), /Discord unavailable/)
    assert.equal(f.calls.length, 0)
})

test("the gateway runner passes the protected interaction to the handler", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] })
    const f = fixture()
    await runInteraction(f.source, async (interaction) => {
        t.mock.timers.tick(1_000)
        assert.ok(interaction.isRepliable())
        await interaction.reply({
            content: "done",
            flags: MessageFlags.Ephemeral,
        })
    })
    assert.deepEqual(
        f.calls.map((c) => c.method),
        ["deferUpdate", "followUp"]
    )
})

test("a slow slash-command modal uses the private waiting message", async (t) => {
    const f = slow(t, "command")
    await f.interaction.showModal(new ModalBuilder())
    await f.finish()
    assert.deepEqual(
        f.calls.map((c) => c.method),
        ["deferReply", "editReply", "freshModal", "edit:@original"]
    )
})

test("an initial response in flight prevents a racing automatic acknowledgement", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] })
    const f = fixture()
    let complete: (() => void) | undefined
    f.original.reply = async () => {
        await new Promise<void>((resolve) => {
            complete = resolve
        })
        f.calls.push({ method: "reply" })
    }
    const guarded = protectInteraction(f.source)
    const reply = guarded.interaction.reply({ content: "done" })
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    assert.ok(complete)
    t.mock.timers.tick(2_000)
    assert.equal(f.calls.length, 0)
    complete?.()
    await reply
    await guarded.finish()
    assert.deepEqual(
        f.calls.map((c) => c.method),
        ["reply"]
    )
})

test("a prepared form submission still updates its original public card", async (t) => {
    const start = slow(t)
    await start.interaction.showModal(new ModalBuilder())
    await start.finish()
    const stranger = fixture("modal")
    stranger.original.message.id = "reply-1"
    stranger.original.user.id = "other-user"
    const unassociated = protectInteraction(stranger.source)
    assert.equal(unassociated.interaction.message.id, "reply-1")
    await unassociated.finish()
    const submit = fixture("modal")
    submit.original.message.id = "reply-1"
    const guarded = protectInteraction(submit.source)
    assert.equal(guarded.interaction.message.id, "shared-message")
    await guarded.interaction.deferUpdate()
    await guarded.interaction.editReply({ content: "updated review" })
    await guarded.finish()
    assert.deepEqual(
        submit.calls.map((c) => c.method),
        ["deferUpdate"]
    )
    assert.equal(start.calls.at(-1)?.method, "editReply")
    assert.deepEqual(start.calls.at(-1)?.options, { content: "updated review" })
})

test("a prepared slash-command form keeps its message-free submission semantics", async (t) => {
    const start = slow(t, "command")
    await start.interaction.showModal(new ModalBuilder())
    await start.finish()
    const submit = fixture("modal")
    submit.original.message.id = "@original"
    const guarded = protectInteraction(submit.source)
    const interaction = guarded.interaction as unknown as {
        isFromMessage: () => boolean
    }
    assert.equal(interaction.isFromMessage(), false)
    await guarded.interaction.reply({
        content: "saved",
        flags: MessageFlags.Ephemeral,
    })
    await guarded.finish()
    assert.deepEqual(
        submit.calls.map((c) => c.method),
        ["reply"]
    )
})
