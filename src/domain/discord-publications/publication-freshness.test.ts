import assert from "node:assert/strict"
import test from "node:test"

import {
    PUBLICATION_RECHECK_MS,
    publicationIsCurrent,
    type StoredPublication,
} from "./publication-freshness"

const now = 1_000_000_000
const row = (
    overrides: Partial<StoredPublication> = {}
): StoredPublication => ({
    revision: 3,
    channelId: "channel",
    messageId: "message",
    pending: null,
    hash: "h1",
    leaseUntil: 0,
    retryAt: 0,
    lastSuccessAt: now - 60_000,
    error: null,
    ...overrides,
})
const input = { revision: 3, channelId: "channel", hash: "h1", now }

test("the same render in the same channel, confirmed recently, is current", () => {
    assert.equal(publicationIsCurrent(row(), input), true)
})

test("a changed render, channel or revision, or an old confirmation, publishes", () => {
    assert.equal(publicationIsCurrent(row(), { ...input, hash: "h2" }), false)
    assert.equal(
        publicationIsCurrent(row(), { ...input, channelId: "other" }),
        false
    )
    assert.equal(publicationIsCurrent(row(), { ...input, revision: 4 }), false)
    assert.equal(
        publicationIsCurrent(
            row({ lastSuccessAt: now - PUBLICATION_RECHECK_MS }),
            input
        ),
        false
    )
    assert.equal(
        publicationIsCurrent(row({ lastSuccessAt: null }), input),
        false
    )
    assert.equal(publicationIsCurrent(row({ messageId: null }), input), false)
})

test("a held lease, a retry wait, an unconfirmed create or a stored error always publish", () => {
    for (const overrides of [
        { leaseUntil: now + 1 },
        { retryAt: now + 1 },
        { pending: { channelId: "channel", marker: "m" } },
        { error: "Chyba" },
    ])
        assert.equal(publicationIsCurrent(row(overrides), input), false)
})

test("withdrawing is current only when nothing is left in Discord", () => {
    const empty = row({ channelId: null, messageId: null, hash: null })
    const withdraw = { ...input, channelId: null }
    assert.equal(publicationIsCurrent(empty, withdraw), true)
    assert.equal(
        publicationIsCurrent(empty, { ...withdraw, now: now + 86_400_000 }),
        true,
        "an empty binding never needs a recheck"
    )
    assert.equal(publicationIsCurrent(row(), withdraw), false)
    assert.equal(
        publicationIsCurrent(
            { ...empty, pending: { channelId: "c", marker: "m" } },
            withdraw
        ),
        false
    )
})
