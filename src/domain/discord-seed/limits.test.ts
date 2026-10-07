import assert from "node:assert/strict"
import test from "node:test"

import { decideSeedPing, seedCooldown, seedDeadline } from "./limits"

const at = (iso: string) => Date.parse(iso)
const MINUTE = 60_000

test("the cooldown names the next allowed start (P5-31: za 1 h 20 min, ve 20:25)", () => {
    const lastStart = at("2026-10-10T16:25:00Z")
    assert.deepEqual(seedCooldown(lastStart, 120, at("2026-10-10T17:05:00Z")), {
        ok: false,
        retryAt: at("2026-10-10T18:25:00Z"),
        remainingMs: 80 * MINUTE,
    })
})

test("the cooldown ends exactly after its length and never applies before a first seed", () => {
    const lastStart = at("2026-10-10T16:25:00Z")
    assert.deepEqual(seedCooldown(lastStart, 120, lastStart + 120 * MINUTE), {
        ok: true,
    })
    assert.deepEqual(seedCooldown(null, 120, lastStart), { ok: true })
    assert.equal(
        seedCooldown(lastStart, 30, lastStart + 29 * MINUTE).ok,
        false,
        "an edited cooldown applies"
    )
})

test("the Seed role is pinged at most once per window; a seed inside it runs silent", () => {
    const now = at("2026-10-03T14:45:00Z")
    assert.deepEqual(
        decideSeedPing({
            roleId: "123456789012345678",
            lastRolePingAt: null,
            pingWindowMinutes: 240,
            now,
        }),
        { kind: "role", roleId: "123456789012345678" }
    )
    assert.deepEqual(
        decideSeedPing({
            roleId: "123456789012345678",
            lastRolePingAt: now - 3 * 60 * MINUTE,
            pingWindowMinutes: 240,
            now,
        }),
        {
            kind: "silent",
            reason: "ping_window",
            windowMinutes: 240,
            nextPingAt: now + 60 * MINUTE,
        }
    )
    assert.equal(
        decideSeedPing({
            roleId: "123456789012345678",
            lastRolePingAt: now - 240 * MINUTE,
            pingWindowMinutes: 240,
            now,
        }).kind,
        "role",
        "the window is half-open"
    )
})

test("without a Seed role the call goes out without a ping", () => {
    assert.deepEqual(
        decideSeedPing({
            roleId: null,
            lastRolePingAt: null,
            pingWindowMinutes: 240,
            now: 0,
        }),
        { kind: "silent", reason: "no_role" }
    )
})

test("the deadline is the start plus the maximum duration", () => {
    assert.equal(seedDeadline(1_000, 120), 1_000 + 120 * MINUTE)
})
