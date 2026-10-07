import type { MessageCreateOptions, MessageEditOptions } from "discord.js"
import assert from "node:assert/strict"
import test from "node:test"

import {
    runPlatformStatusPass,
    type PlatformStatusPorts,
} from "./platform-status"
import type { ServiceState } from "../../src/domain/discord-messages/service-status"

type Json = Record<string, unknown> & { components?: Json[] }
const textOf = (payload: MessageCreateOptions | MessageEditOptions) => {
    const container = JSON.parse(
        JSON.stringify(
            (payload.components as Array<{ toJSON(): unknown }>)[0]!.toJSON()
        )
    ) as Json & { accent_color: number }
    const parts: string[] = []
    const walk = (node: Json) => {
        if (typeof node.content === "string") parts.push(node.content)
        for (const child of node.components ?? []) walk(child)
    }
    walk(container)
    return { accent: container.accent_color, text: parts.join("\n") }
}

const at = (iso: string) => Date.parse(iso)

function fakes(input: {
    states?: ServiceState[]
    services: Array<{ name: string; online: boolean }> | null
    now: string
    hasMessage?: boolean
    threadName?: string
}) {
    const edits: MessageEditOptions[] = []
    const created: MessageCreateOptions[] = []
    const threadPosts: MessageCreateOptions[] = []
    const renames: string[] = []
    const saved: unknown[] = []
    const thread = {
        name: input.threadName ?? "Změny stavu",
        setName: async (name: string) => {
            renames.push(name)
        },
        send: async (options: MessageCreateOptions) => {
            threadPosts.push(options)
        },
    }
    const ports: PlatformStatusPorts = {
        settings: async () => ({
            workspaceGuildId: "1",
            statusChannelId: "2",
            statusMessageId: input.hasMessage === false ? undefined : "3",
            statusUpdatesThreadId: input.hasMessage === false ? undefined : "4",
            serviceStates: input.states,
        }),
        services: async () => input.services,
        language: async () => "cs",
        statusMessage: async (_channel, id) =>
            id
                ? {
                      edit: async (options: MessageEditOptions) => {
                          edits.push(options)
                      },
                  }
                : null,
        createStatusMessage: async (_channel, message, threadName) => {
            created.push(message)
            renames.push(`created:${threadName}`)
            return { messageId: "30", threadId: "40" }
        },
        thread: async () => thread,
        save: async (state) => {
            saved.push(state)
        },
        now: () => at(input.now),
    }
    return { ports, edits, created, threadPosts, renames, saved }
}

const up = [
    { name: "Dashboard", online: true },
    { name: "Convex", online: true },
    { name: "Discord bot", online: true },
]
const botDown = up.map((service) =>
    service.name === "Discord bot" ? { ...service, online: false } : service
)

test("the status message is edited in place in Czech with the grey bar (L5-33, L5-34)", async () => {
    const run = fakes({
        services: up,
        now: "2026-10-11T12:16:00.000Z",
        states: up.map((service) => ({
            ...service,
            since: "2026-10-11T08:00:00.000Z",
        })),
    })
    await runPlatformStatusPass(run.ports)
    assert.equal(run.edits.length, 1)
    assert.equal(run.created.length, 0)
    const card = textOf(run.edits[0]!)
    assert.equal(card.accent, 0x80848e)
    assert.match(card.text, /-# \*\*SLUŽBY LOGI\*\*\n### Všechno běží/)
    assert.match(
        card.text,
        /Kontrola každých 30 s · naposledy dnes v <t:\d+:t>/
    )
    assert.match(card.text, /\*\*Discord bot\*\* · 🟢 \*\*V provozu\*\*/)
    assert.match(card.text, /Změny stavu jsou ve vlákně · Spravováno v Logi/)
    assert.equal(run.threadPosts.length, 0)
    assert.equal(run.edits[0]!.embeds?.length, 0)
})

test("an outage and its recovery post grey cards with the duration (L5-35, L5-37)", async () => {
    const down = fakes({
        services: botDown,
        now: "2026-10-11T12:02:00.000Z",
        states: up.map((service) => ({
            ...service,
            since: "2026-10-11T08:00:00.000Z",
        })),
    })
    const result = await runPlatformStatusPass(down.ports)
    assert.match(textOf(down.edits[0]!).text, /### Discord bot nefunguje/)
    assert.equal(down.threadPosts.length, 1)
    const post = textOf(down.threadPosts[0]!)
    assert.equal(post.accent, 0x80848e)
    assert.match(
        post.text,
        /### Discord bot nefunguje\nVýpadek začal v <t:\d+:t>\./
    )
    const recovered = fakes({
        services: up,
        now: "2026-10-11T12:09:00.000Z",
        states: result!.states,
    })
    await runPlatformStatusPass(recovered.ports)
    assert.match(
        textOf(recovered.threadPosts[0]!).text,
        /### Discord bot zase běží\nVýpadek trval 7 minut\./
    )
})

test("a silent monitor shows 'Stav teď neznáme' and keeps the stored states (L5-36)", async () => {
    const states = botDown.map((service) => ({
        ...service,
        since: "2026-10-11T12:02:00.000Z",
    }))
    const run = fakes({
        services: null,
        now: "2026-10-11T12:05:00.000Z",
        states,
    })
    await runPlatformStatusPass(run.ports)
    const card = textOf(run.edits[0]!)
    assert.match(
        card.text,
        /### Stav teď neznáme\n⚪ \*\*Monitoring neodpovídá\*\*/
    )
    // The stored states stay as they are: nothing to save.
    assert.deepEqual(run.saved, [])
    assert.equal(run.threadPosts.length, 0)
})

test("an unchanged check saves nothing; a change, a new message or a new service saves once", async () => {
    const states = up.map((service) => ({
        ...service,
        since: "2026-10-11T08:00:00.000Z",
    }))
    const same = fakes({
        services: up,
        now: "2026-10-11T12:16:00.000Z",
        states,
    })
    await runPlatformStatusPass(same.ports)
    assert.equal(same.edits.length, 1)
    assert.deepEqual(same.saved, [])
    const down = fakes({
        services: botDown,
        now: "2026-10-11T12:16:00.000Z",
        states,
    })
    await runPlatformStatusPass(down.ports)
    assert.equal(down.saved.length, 1)
    const added = fakes({
        services: [...up, { name: "Web", online: true }],
        now: "2026-10-11T12:16:00.000Z",
        states,
    })
    await runPlatformStatusPass(added.ports)
    assert.equal(added.saved.length, 1)
    const posted = fakes({
        services: up,
        now: "2026-10-11T12:16:00.000Z",
        states,
        hasMessage: false,
    })
    await runPlatformStatusPass(posted.ports)
    assert.equal(posted.saved.length, 1)
})

test("a missing message is posted with the 'Změny stavu' thread; old threads are renamed", async () => {
    const fresh = fakes({
        services: up,
        now: "2026-10-11T12:00:00.000Z",
        hasMessage: false,
    })
    await runPlatformStatusPass(fresh.ports)
    assert.equal(fresh.created.length, 1)
    assert.ok(fresh.renames.includes("created:Změny stavu"))
    assert.deepEqual(fresh.saved[0], {
        statusMessageId: "30",
        statusUpdatesThreadId: "40",
        serviceStates: up.map((service) => ({
            ...service,
            since: "2026-10-11T12:00:00.000Z",
        })),
    })
    const legacy = fakes({
        services: up,
        now: "2026-10-11T12:00:00.000Z",
        threadName: "Status updates",
    })
    await runPlatformStatusPass(legacy.ports)
    assert.deepEqual(legacy.renames, ["Změny stavu"])
})
