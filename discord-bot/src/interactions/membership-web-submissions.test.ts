import { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"
import type { Client } from "discord.js"
import assert from "node:assert/strict"
import test from "node:test"

import { processSubmission } from "./membership-web-submissions"

test("a busy submission is never released after a guild lookup failure", async (t) => {
    const calls: string[] = []
    t.mock.method(
        ConvexReactClient.prototype,
        "mutation",
        async (reference: Parameters<typeof getFunctionName>[0]) => {
            calls.push(getFunctionName(reference))
            return { ok: false, reason: "busy" }
        }
    )
    const client = {
        guilds: {
            cache: new Map(),
            fetch: async () => {
                throw new Error("unavailable")
            },
        },
    } as unknown as Client

    await processSubmission(client, {
        draftId: "draft",
        guildId: "guild",
        creatorId: "user",
    })
    assert.deepEqual(calls, [
        "membershipApplications:claimApplicationSubmission",
    ])
})

test("a guild lookup failure releases only a successfully claimed submission", async (t) => {
    const calls: string[] = []
    t.mock.method(
        ConvexReactClient.prototype,
        "mutation",
        async (reference: Parameters<typeof getFunctionName>[0]) => {
            const name = getFunctionName(reference)
            calls.push(name)
            if (name === "membershipApplications:claimApplicationSubmission")
                return { ok: true, submission: { claimToken: "claim" } }
            return { ok: true }
        }
    )
    const client = {
        guilds: {
            cache: new Map(),
            fetch: async () => {
                throw new Error("unavailable")
            },
        },
    } as unknown as Client

    await processSubmission(client, {
        draftId: "draft",
        guildId: "guild",
        creatorId: "user",
    })
    assert.deepEqual(calls, [
        "membershipApplications:claimApplicationSubmission",
        "membershipApplications:releaseApplicationSubmission",
    ])
})
