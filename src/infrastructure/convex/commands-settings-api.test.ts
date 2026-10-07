import assert from "node:assert/strict"
import test from "node:test"

import { invoke, testContext } from "./testing/database"
import * as publicApi from "../../../convex/publicApi"

process.env.INTERNAL_AUTH_SECRET = "dev-internal-auth-secret"
const secret = process.env.INTERNAL_AUTH_SECRET
const GUILD = "guild-a"

function setup() {
    const ctx = testContext()
    ctx.db.seed("apiKeys", {
        _id: "apiKeys:writer",
        keyHash: "key",
        guildId: GUILD,
    })
    ctx.db.seed("guilds", { _id: "guilds:a", discordId: GUILD, name: "Vlci" })
    ctx.db.seed("discordConfigs", {
        _id: "discordConfigs:a",
        guildId: GUILD,
        timezone: "Europe/Prague",
        defaultLanguage: "cs",
    })
    return ctx
}

let request = 0
const patch = (
    ctx: ReturnType<typeof setup>,
    body: Record<string, unknown>
): Promise<{ status: number; body: string }> =>
    invoke(publicApi.mutateClanSettings, ctx, {
        secret,
        keyHash: "key",
        idempotencyKey: `commands-${++request}`,
        bodyHash: `body-${request}`,
        methodPath: "PATCH /clan/settings",
        ...body,
    })

const registrations = (ctx: ReturnType<typeof setup>) =>
    (ctx.db.tables.discordCommandRegistrations ?? []) as Array<{
        requestedAt?: number
        requestKind?: string
    }>

test("a saved commands slice asks the bot to register again, as the Příkazy page does (M1-B01, N3-B02)", async () => {
    const ctx = setup()
    const saved = await patch(ctx, {
        slices: { commands: { player: { audience: "clanMembers" } } },
    })
    assert.equal(saved.status, 200)
    const [row] = registrations(ctx)
    assert.ok(row?.requestedAt)
    assert.equal(row.requestKind, "save")
})

test("other settings and a refused commands patch do not ask for a registration", async () => {
    const ctx = setup()
    assert.equal((await patch(ctx, { timezone: "UTC" })).status, 200)
    assert.deepEqual(registrations(ctx), [])
    const refused = await patch(ctx, {
        slices: { commands: { player: { audience: "nobody" } } },
    })
    assert.equal(refused.status, 400)
    assert.deepEqual(registrations(ctx), [])
})
