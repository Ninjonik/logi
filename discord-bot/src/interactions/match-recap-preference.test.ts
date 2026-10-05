import type { ButtonInteraction, ContainerBuilder } from "discord.js"
import { createInteractionHandler } from "../interactions"
import { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"
import { closeConvexClient } from "../convex"
import test, { afterEach } from "node:test"
import assert from "node:assert/strict"

import { parseRecapAction } from "./match-recap-preference"

afterEach(closeConvexClient)

const context = {
    config: {
        id: "config-1",
        guildId: "guild-1",
        timezone: "Europe/Prague",
        defaultLanguage: "cs",
        calendarCategories: [],
        updatedAt: "2026-10-01T10:00:00.000Z",
    },
    event: {
        id: "event-1",
        guildId: "guild-1",
        gameId: "hell_let_loose",
        kind: "match",
        name: "VLK vs ROG",
        gameStart: "2026-10-11T18:00:00.000Z",
    },
    groups: [],
    roster: null,
}

const recap = {
    userId: "user-1",
    kills: 36,
    deaths: 15,
    kd: 2.4,
}

test("recap button IDs carry the match so the clan language is known", () => {
    assert.deepEqual(parseRecapAction("match-recap:unsubscribe:event-1"), {
        enabled: false,
        eventId: "event-1",
    })
    assert.deepEqual(parseRecapAction("match-recap:subscribe"), {
        enabled: true,
        eventId: undefined,
    })
    assert.equal(parseRecapAction("match-recap:unknown-subscribe"), null)
})

for (const [action, expected] of [
    ["unsubscribe", false],
    ["subscribe", true],
] as const) {
    test(`${action} persists ${expected} and redraws the same DM in the clan language`, async (t) => {
        const mutations: unknown[] = []
        t.mock.method(
            ConvexReactClient.prototype,
            "mutation",
            async (_reference: unknown, args: unknown) => {
                mutations.push(args)
            }
        )
        t.mock.method(
            ConvexReactClient.prototype,
            "query",
            async (reference: Parameters<typeof getFunctionName>[0]) => {
                const name = getFunctionName(reference)
                if (name.endsWith("getEventInteractionContext")) return context
                if (name.endsWith("recapCard")) return recap
                return null
            }
        )
        let response: { components: ContainerBuilder[] } | undefined
        await createInteractionHandler({
            enqueueEventSync: () => {},
            triggerPollSoon: () => {},
        }).handleButtonInteraction({
            customId: `match-recap:${action}:event-1`,
            guildId: null,
            // The Discord client's language must not matter.
            locale: "en-US",
            user: { id: "222222222222222222" },
            client: { guilds: { cache: new Map() } },
            update: async (value: typeof response) => {
                response = value
            },
        } as unknown as ButtonInteraction)
        assert.deepEqual(mutations, [
            {
                secret: "dev-internal-auth-secret",
                userId: "222222222222222222",
                enabled: expected,
            },
        ])
        assert.ok(response)
        const content = JSON.stringify(
            response.components.map((item) => item.toJSON())
        )
        assert.match(
            content,
            new RegExp(
                `match-recap:${expected ? "unsubscribe" : "subscribe"}:event-1`
            )
        )
        if (expected) assert.match(content, /Vypnout shrnutí/)
        else {
            assert.match(content, /Shrnutí vypnutá/)
            assert.match(content, /platí pro všechny tvoje klany v Logi/)
            assert.match(content, /Zapnout shrnutí/)
            assert.match(content, /Otevřít nastavení/)
        }
    })
}

test("unknown recap actions cannot change the notification preference", async (t) => {
    t.mock.method(ConvexReactClient.prototype, "mutation", async () =>
        assert.fail("Invalid control must not mutate")
    )
    let rejected = false
    await createInteractionHandler({
        enqueueEventSync: () => {},
        triggerPollSoon: () => {},
    }).handleButtonInteraction({
        customId: "match-recap:unknown-subscribe",
        guildId: null,
        locale: "en-US",
        user: { id: "222222222222222222" },
        client: { guilds: { cache: new Map() } },
        deferred: false,
        replied: false,
        reply: async () => {
            rejected = true
        },
    } as unknown as ButtonInteraction)
    assert.equal(rejected, true)
})
