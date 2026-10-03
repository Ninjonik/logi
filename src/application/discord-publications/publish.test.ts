import {
    publish,
    PublicationNotSent,
    type Publication,
    type PublicationStore,
    type PublicationTransport,
} from "./publish"
import assert from "node:assert/strict"
import test from "node:test"

function fixture(initial: Partial<Publication> = {}) {
    let state: Publication = {
        id: "binding",
        fence: 1,
        channelId: null,
        messageId: null,
        pending: null,
        hash: null,
        ...initial,
    }
    let locked = false
    const calls: string[] = []
    const messages = new Map<string, string>()
    const store: PublicationStore = {
        claim: async () => {
            if (locked) return null
            locked = true
            return structuredClone(state)
        },
        save: async (next) => {
            state = structuredClone(next)
        },
        finish: async () => {
            locked = false
        },
    }
    const transport: PublicationTransport = {
        exists: async (channel, id) => {
            calls.push(`fetch:${channel}:${id}`)
            return messages.has(`${channel}:${id}`)
        },
        recover: async (channel, marker) =>
            [...messages]
                .find(
                    ([key, value]) =>
                        key.startsWith(`${channel}:`) && value === marker
                )?.[0]
                .split(":")[1] ?? null,
        create: async (channel, marker) => {
            calls.push(`create:${channel}`)
            messages.set(`${channel}:new`, marker)
            return "new"
        },
        edit: async (channel, id) => {
            calls.push(`edit:${channel}:${id}`)
        },
        remove: async (channel, id) => {
            calls.push(`delete:${channel}:${id}`)
            messages.delete(`${channel}:${id}`)
        },
    }
    return { store, transport, messages, calls, state: () => state }
}
test("a restart edits the persisted message and unchanged data skips edits", async () => {
    const f = fixture({ channelId: "a", messageId: "original" })
    f.messages.set("a:original", "owned")
    await publish(f.store, f.transport, "a", "v1")
    await publish(f.store, f.transport, "a", "v1")
    assert.deepEqual(f.calls, [
        "fetch:a:original",
        "edit:a:original",
        "fetch:a:original",
    ])
})
test("an uncertain create is recovered after restart without a second POST", async () => {
    const f = fixture()
    const create = f.transport.create
    f.transport.create = async (...args) => {
        await create(...args)
        throw new Error("timeout after Discord accepted")
    }
    await assert.rejects(publish(f.store, f.transport, "a", "v1"))
    assert.ok(f.state().pending)
    await publish(f.store, f.transport, "a", "v1")
    assert.equal(f.calls.filter((c) => c.startsWith("create")).length, 1)
    assert.equal(f.state().messageId, "new")
})
test("an unresolved create blocks resending even if history has no matching marker", async () => {
    const f = fixture({ pending: { channelId: "a", marker: "known-attempt" } })
    await assert.rejects(publish(f.store, f.transport, "a", "v1"), /uncertain/)
    assert.equal(f.calls.length, 0)
})
test("permission errors and rate limits retain bindings; confirmed missing can replace", async () => {
    for (const code of [50013, 429, "ETIMEDOUT"]) {
        const f = fixture({ channelId: "a", messageId: "original" })
        f.transport.exists = async () => {
            throw Object.assign(new Error("Discord unavailable"), { code })
        }
        await assert.rejects(publish(f.store, f.transport, "a", "v1"))
        assert.equal(f.state().messageId, "original")
        assert.equal(f.calls.length, 0)
    }
    const f = fixture({ channelId: "a", messageId: "deleted" })
    await publish(f.store, f.transport, "a", "v1")
    assert.equal(f.state().messageId, "new")
})
test("move waits for old deletion, including when configuration changes during uncertain creation", async () => {
    const f = fixture({ pending: { channelId: "old", marker: "attempt" } })
    f.messages.set("old:original", "attempt")
    f.transport.remove = async () => {
        throw new Error("forbidden")
    }
    await assert.rejects(publish(f.store, f.transport, "new", "v1"))
    assert.equal(f.state().messageId, "original")
    assert.ok(!f.calls.some((c) => c.startsWith("create")))
})
test("a concurrent worker does not create while the first owns the lease", async () => {
    const f = fixture()
    await Promise.all([
        publish(f.store, f.transport, "a", "v1"),
        publish(f.store, f.transport, "a", "v1"),
    ])
    assert.equal(f.calls.filter((c) => c.startsWith("create")).length, 1)
})
test("a definite create rejection is retryable after configuration repair", async () => {
    const f = fixture()
    const create = f.transport.create
    f.transport.create = async () => {
        throw new PublicationNotSent("missing permission")
    }
    await assert.rejects(publish(f.store, f.transport, "a", "v1"))
    assert.equal(f.state().pending, null)
    f.transport.create = create
    await publish(f.store, f.transport, "a", "v1")
    assert.equal(f.state().messageId, "new")
})
