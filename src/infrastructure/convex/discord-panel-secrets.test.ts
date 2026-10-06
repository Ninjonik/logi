import test, { type TestContext } from "node:test"
import { randomBytes } from "node:crypto"
import assert from "node:assert/strict"

import {
    serverPasswordAad,
    serverPasswordPlaintext,
} from "../../domain/discord-publications/server-join"
import {
    openSecret,
    parseKeyring,
    sealSecret,
} from "../game-data/credential-cipher"
import * as secrets from "../../../convex/discordPanelSecrets"

const secret = "synthetic-panel-secret"
const guildId = "100000000000000099"
const connectionId = "gameDataConnections:hll"
const PASSWORD = "sentinel-password-91"
const material = () => randomBytes(32).toString("base64")

function environment(t: TestContext, keyring: string | undefined) {
    const previous = {
        secret: process.env.INTERNAL_AUTH_SECRET,
        keyring: process.env.LOGI_CREDENTIAL_KEYRING,
    }
    process.env.INTERNAL_AUTH_SECRET = secret
    if (keyring === undefined) delete process.env.LOGI_CREDENTIAL_KEYRING
    else process.env.LOGI_CREDENTIAL_KEYRING = keyring
    t.after(() => {
        if (previous.secret === undefined)
            delete process.env.INTERNAL_AUTH_SECRET
        else process.env.INTERNAL_AUTH_SECRET = previous.secret
        if (previous.keyring === undefined)
            delete process.env.LOGI_CREDENTIAL_KEYRING
        else process.env.LOGI_CREDENTIAL_KEYRING = previous.keyring
    })
}

/** Calls the action handler with a fake `runQuery` returning the stored row. */
async function run(stored: unknown, args: Record<string, unknown>) {
    const queries: unknown[] = []
    const result = await (
        secrets.serverPassword as unknown as {
            _handler: (ctx: unknown, args: unknown) => Promise<unknown>
        }
    )._handler(
        {
            runQuery: async (_ref: unknown, input: unknown) => {
                queries.push(input)
                return stored
            },
        },
        args
    )
    return { result, queries }
}

test("a sealed password opens only with its workspace and server binding", () => {
    const ring = parseKeyring(
        JSON.stringify({ current: "k1", keys: { k1: material() } })
    )!
    const aad = serverPasswordAad({ guildId, connectionId })
    const envelope = sealSecret(ring, serverPasswordPlaintext("x"), aad)
    assert.equal(JSON.stringify(envelope).includes('"x"'), false)
    assert.equal(openSecret(ring, envelope, aad), serverPasswordPlaintext("x"))
    assert.throws(() =>
        openSecret(
            ring,
            envelope,
            serverPasswordAad({ guildId: "other", connectionId })
        )
    )
    assert.throws(() => sealSecret(ring, "short", aad))
})

test("the bot gets the password back; the query is scoped to the panel", async (t) => {
    const raw = JSON.stringify({ current: "k1", keys: { k1: material() } })
    environment(t, raw)
    const envelope = sealSecret(
        parseKeyring(raw)!,
        serverPasswordPlaintext(PASSWORD),
        serverPasswordAad({ guildId, connectionId })
    )
    const { result, queries } = await run(
        { connectionId, envelope },
        { secret, guildId, panelId: "discordPublicPanels:1" }
    )
    assert.deepEqual(result, { password: PASSWORD })
    assert.deepEqual(queries, [{ guildId, panelId: "discordPublicPanels:1" }])
})

test("no fallback: a missing key, a foreign binding or no password give none", async (t) => {
    const raw = JSON.stringify({ current: "k1", keys: { k1: material() } })
    const envelope = sealSecret(
        parseKeyring(raw)!,
        serverPasswordPlaintext(PASSWORD),
        serverPasswordAad({ guildId: "200000000000000099", connectionId })
    )
    environment(t, raw)
    const foreign = await run(
        { connectionId, envelope },
        { secret, guildId, panelId: "p" }
    )
    assert.deepEqual(foreign.result, {
        password: null,
        reason: "decrypt_failed",
    })
    assert.deepEqual(
        (await run(null, { secret, guildId, panelId: "p" })).result,
        {
            password: null,
            reason: "not_set",
        }
    )
    delete process.env.LOGI_CREDENTIAL_KEYRING
    const missing = await run(
        { connectionId, envelope },
        { secret, guildId, panelId: "p" }
    )
    assert.equal(
        missing.result && (missing.result as { password: null }).password,
        null
    )
    assert.doesNotMatch(JSON.stringify(missing.result), new RegExp(PASSWORD))
    await assert.rejects(
        run(
            { connectionId, envelope },
            { secret: "wrong", guildId, panelId: "p" }
        ),
        /Unauthorized/
    )
})
