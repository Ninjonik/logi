import type { Client, EmbedBuilder } from "discord.js"
import { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"
import { closeConvexClient } from "../convex"
import test, { afterEach } from "node:test"
import assert from "node:assert/strict"

import { buildMatchRecapCopy, processMatchRecaps } from "./match-recaps"

afterEach(closeConvexClient)

test("builds match recap copy in the configured clan language", () => {
    const recap = {
        userId: "user-1",
        eventName: "Operation Test",
        mapName: "Foy",
        kills: 28,
        deaths: 16,
        kd: 1.75,
        previousTen: { matches: 4, kills: 21.5, deaths: 18.2, kd: 1.18 },
    }

    const czech = buildMatchRecapCopy("cs", recap)

    assert.equal(czech.title, "Shrnutí zápasu - Operation Test")
    assert.match(czech.description, /28.*zabití/)
    assert.match(czech.comparisonTitle, /předchozími zápasy/)
    assert.equal(czech.viewStats, "Zobrazit veřejné statistiky zápasu")
})

test("uses localized fallback comparison copy when no history exists", () => {
    const german = buildMatchRecapCopy("de", {
        userId: "user-1",
        eventName: "Operation Test",
        kills: 28,
        deaths: 16,
        kd: 1.75,
    })

    assert.equal(german.comparisonTitle, "Vergleich mit früheren Spielen")
    assert.match(german.comparison, /keine früheren gespeicherten Spiele/)
    assert.equal(german.unsubscribe, "Zusammenfassungen abbestellen")
})

const delivery = {
    recapId: "matchRecaps:one",
    userId: "imported/player",
    discordUserId: "222222222222222222",
    eventName: "Synthetic match",
    kills: 4,
    deaths: 2,
    kd: 2,
}
test("actual recap runner uses Discord subject, rechecks eligibility and keeps the data ID in links", async (t) => {
    const calls: unknown[] = [],
        targets: string[] = []
    t.mock.method(
        ConvexReactClient.prototype,
        "query",
        async (
            reference: Parameters<typeof getFunctionName>[0],
            args: unknown
        ) => {
            calls.push([getFunctionName(reference), args])
            return getFunctionName(reference).endsWith("listPendingForEvent")
                ? [delivery]
                : delivery
        }
    )
    t.mock.method(
        ConvexReactClient.prototype,
        "mutation",
        async (_reference: unknown, args: unknown) => {
            calls.push(["mark", args])
        }
    )
    let embed: ReturnType<EmbedBuilder["toJSON"]> | undefined
    const client = {
        users: {
            fetch: async (id: string) => {
                targets.push(id)
                return {
                    send: async (payload: { embeds: EmbedBuilder[] }) => {
                        embed = payload.embeds[0].toJSON()
                    },
                }
            },
        },
    } as unknown as Client
    await processMatchRecaps(client, "events:one", "cs")
    assert.deepEqual(targets, [delivery.discordUserId])
    assert.equal(calls.length, 3)
    assert.deepEqual(calls[1], [
        "matchRecaps:prepareDelivery",
        {
            secret: "dev-internal-auth-secret",
            recapId: delivery.recapId,
            eventId: "events:one",
            discordUserId: delivery.discordUserId,
        },
    ])
    assert.match(
        embed?.url ?? "",
        /\/players\/imported%2Fplayer\/matches\/events%3Aone$/
    )
    assert.deepEqual(calls[2], [
        "mark",
        {
            secret: "dev-internal-auth-secret",
            recapId: delivery.recapId,
            discordUserId: delivery.discordUserId,
        },
    ])
})

test("unsubscribe or relink during Discord lookup stops a previously listed recap", async (t) => {
    let lookedUp = false,
        prepared = false,
        sent = false
    t.mock.method(
        ConvexReactClient.prototype,
        "query",
        async (reference: Parameters<typeof getFunctionName>[0]) => {
            if (getFunctionName(reference).endsWith("listPendingForEvent"))
                return [delivery]
            assert.equal(lookedUp, true)
            prepared = true
            return null
        }
    )
    t.mock.method(ConvexReactClient.prototype, "mutation", async () =>
        assert.fail("No sent marker")
    )
    const client = {
        users: {
            fetch: async () => {
                lookedUp = true
                return {
                    send: async () => {
                        sent = true
                    },
                }
            },
        },
    } as unknown as Client
    await processMatchRecaps(client, "events:one", "cs")
    assert.equal(prepared, true)
    assert.equal(sent, false)
})

test("failed Discord sends never create a sent marker", async (t) => {
    t.mock.method(
        ConvexReactClient.prototype,
        "query",
        async (reference: Parameters<typeof getFunctionName>[0]) =>
            getFunctionName(reference).endsWith("listPendingForEvent")
                ? [delivery]
                : delivery
    )
    t.mock.method(ConvexReactClient.prototype, "mutation", async () =>
        assert.fail("No sent marker after failure")
    )
    let attempts = 0
    const client = {
        users: {
            fetch: async () => ({
                send: async () => {
                    attempts++
                    throw new Error("Synthetic provider unavailable")
                },
            }),
        },
    } as unknown as Client
    await processMatchRecaps(client, "events:one", "en")
    assert.equal(attempts, 1)
})

test("legacy delivery records cannot trigger a Discord lookup", async (t) => {
    t.mock.method(ConvexReactClient.prototype, "query", async () => [
        { userId: "222222222222222222" },
    ])
    const client = {
        users: { fetch: async () => assert.fail("Unbound recipient") },
    } as unknown as Client
    await processMatchRecaps(client, "events:one", "en")
})
