import { mkdtempSync, writeFileSync } from "node:fs"
import assert from "node:assert/strict"
import { tmpdir } from "node:os"
import test from "node:test"
import path from "node:path"

import { MINIMUM_BOT_VERSION } from "../../../src/domain/discord-publications/panel-delivery"
import { readPackageVersion, resolveBotVersion } from "./bot-version"

test("the operator's LOGI_BOT_VERSION wins, else the package version (P1-06)", () => {
    assert.equal(
        resolveBotVersion({ override: "1.2.3", packageVersion: "1.1.0" }),
        "1.2.3"
    )
    assert.equal(
        resolveBotVersion({ override: "", packageVersion: "1.1.0" }),
        "1.1.0"
    )
    assert.equal(
        resolveBotVersion({ override: undefined, packageVersion: null }),
        "unknown"
    )
    // Only what the heartbeat schema accepts, at most 40 characters.
    assert.equal(
        resolveBotVersion({
            override: "1.0.268; rm -rf",
            packageVersion: null,
        }),
        "1.0.268rm-rf"
    )
    assert.equal(
        resolveBotVersion({ override: "x".repeat(60), packageVersion: null })
            .length,
        40
    )
})

test("the package version is read from the bot's package.json", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "logi-bot-version-"))
    const file = path.join(dir, "package.json")
    writeFileSync(file, JSON.stringify({ name: "logi", version: "1.1.0" }))
    assert.equal(readPackageVersion(file), "1.1.0")
    writeFileSync(file, "{")
    assert.equal(readPackageVersion(file), null)
    assert.equal(readPackageVersion(path.join(dir, "missing.json")), null)
})

test("the bot built from this repository reports the minimum version or newer", () => {
    const own = readPackageVersion(
        new URL("../../../package.json", import.meta.url)
    )
    assert.ok(own)
    const parts = (value: string) =>
        value
            .split(/[.+-]/)
            .slice(0, 3)
            .map((part) => Number.parseInt(part, 10))
    const [a, b] = [parts(own), parts(MINIMUM_BOT_VERSION)]
    const order = a[0]! - b[0]! || a[1]! - b[1]! || a[2]! - b[2]!
    assert.ok(order >= 0, `${own} < ${MINIMUM_BOT_VERSION}`)
})
