import { eventDeliveryHandler } from "./event-delivery-route"
import assert from "node:assert/strict"
import test from "node:test"
const params = { serverId: "clan-a", eventId: "event-a" }
const request = new Request("http://localhost/events/event-a/delivery")

test("delivery status never reads bot state without clan-manager access or a scoped published event", async () => {
    for (const [access, status] of [
        [null, 403],
        [{ guildId: "guild", event: null }, 404],
        [{ guildId: "guild", event: { id: "draft", isDraft: true } }, 404],
    ] as const) {
        const handler = eventDeliveryHandler({
            access: async () => access,
            messages: async () => {
                assert.fail("must not read unauthorized state")
            },
        })
        assert.equal((await handler(request, params)).status, status)
    }
})

test("delivery distinguishes waiting, missing destination and confirmed message links", async () => {
    const access = {
        guildId: "guild",
        event: { id: "event-a" },
        configuredChannelId: "announcements",
    }
    for (const [config, messages, expected] of [
        [access, null, { status: "pending", href: null }],
        [
            { ...access, configuredChannelId: undefined },
            null,
            { status: "unavailable", href: null },
        ],
        [
            access,
            {
                announcementChannelId: "actual",
                announcementMessageId: "message",
            },
            {
                status: "delivered",
                href: "https://discord.com/channels/guild/actual/message",
            },
        ],
    ] as const) {
        const handler = eventDeliveryHandler({
            access: async () => config,
            messages: async (id) => {
                assert.equal(id, "event-a")
                return messages
            },
        })
        const result = await handler(request, params)
        assert.equal(result.headers.get("Cache-Control"), "no-store")
        assert.deepEqual(await result.json(), expected)
    }
})
