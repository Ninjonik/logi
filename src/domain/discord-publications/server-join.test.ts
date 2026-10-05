import assert from "node:assert/strict"
import test from "node:test"

import {
    isServerAddress,
    joinCodeSchema,
    passwordShown,
    passwordWithheldNotice,
    serverJoinSlugBase,
    serverJoinUrl,
    serverPasswordAad,
    serverPasswordFromPlaintext,
    serverPasswordPlaintext,
    serverPasswordSchema,
    steamConnectUrl,
    uniqueServerJoinSlug,
} from "./server-join"

test("only host:port addresses become steam://connect links", () => {
    for (const address of [
        "203.0.113.24:7777",
        "[2001:db8::1]:7777",
        "hll.example.net:7777",
    ])
        assert.equal(steamConnectUrl(address), `steam://connect/${address}`)
    for (const address of [
        "203.0.113.24",
        "203.0.113.256:7777",
        "host:0",
        "host:70000",
        "javascript:alert(1)",
        "a b:7777",
        "host:7777/path",
    ]) {
        assert.equal(isServerAddress(address), false, address)
        assert.equal(steamConnectUrl(address), null)
    }
})

test("Wardogs join codes are short letters, digits and dashes", () => {
    assert.equal(joinCodeSchema.parse(" WD-4821 "), "WD-4821")
    assert.equal(joinCodeSchema.safeParse("WD 4821").success, false)
    assert.equal(joinCodeSchema.safeParse("x".repeat(25)).success, false)
})

test("join links are short, global and unique", () => {
    assert.equal(serverJoinSlugBase("Vlci #1 · Public"), "vlci-1")
    assert.equal(serverJoinSlugBase("Žluťoučký kůň"), "zlutoucky-kun")
    assert.equal(serverJoinSlugBase("###"), "server")
    const taken = new Set(["vlci-1", "vlci-1-2"])
    assert.equal(
        uniqueServerJoinSlug("Vlci #1", (slug) => taken.has(slug)),
        "vlci-1-3"
    )
    assert.equal(
        serverJoinUrl("https://logi.app/en/dashboard", "vlci-1"),
        "https://logi.app/join/vlci-1"
    )
    assert.equal(serverJoinUrl("https://logi.app", "../admin"), null)
    assert.equal(serverJoinUrl("javascript:alert(1)", "vlci-1"), null)
})

test("passwords are bound to their workspace and server and survive one letter", () => {
    const sealed = serverPasswordPlaintext("x")
    assert.ok(sealed.length >= 8)
    assert.equal(serverPasswordFromPlaintext(sealed), "x")
    assert.notEqual(
        serverPasswordAad({ guildId: "g1", connectionId: "c1" }),
        serverPasswordAad({ guildId: "g2", connectionId: "c1" })
    )
    assert.equal(serverPasswordSchema.safeParse("a\nb").success, false)
    assert.equal(serverPasswordSchema.safeParse("").success, false)
    assert.throws(() => serverPasswordFromPlaintext('{"v":2,"password":"x"}'))
})

test("the password shows only on a server's own panel in a channel @everyone cannot view", () => {
    const base = {
        kind: "server",
        switchOn: true,
        stored: true,
        everyoneCanView: false,
    }
    assert.equal(passwordShown(base), true)
    assert.equal(passwordShown({ ...base, everyoneCanView: true }), false)
    assert.equal(passwordShown({ ...base, kind: "servers" }), false)
    assert.equal(passwordShown({ ...base, switchOn: false }), false)
    assert.equal(passwordShown({ ...base, stored: false }), false)
})

test("admins are told once when the channel turns public", () => {
    const base = {
        kind: "server",
        switchOn: true,
        stored: true,
        everyoneCanView: true,
        alreadyNotified: false,
    }
    assert.equal(passwordWithheldNotice(base), true)
    assert.equal(
        passwordWithheldNotice({ ...base, alreadyNotified: true }),
        false
    )
    assert.equal(
        passwordWithheldNotice({ ...base, everyoneCanView: false }),
        false
    )
})
