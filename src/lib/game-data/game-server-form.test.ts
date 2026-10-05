import {
    fill,
    keyField,
    PROVIDERS_BY_GAME,
    readCommandResult,
} from "./game-server-form"
import assert from "node:assert/strict"
import test from "node:test"

test("the form offers each game's providers and the right key field", () => {
    assert.deepEqual(PROVIDERS_BY_GAME.hell_let_loose, ["hll_crcon"])
    assert.equal(keyField("wardogs_warcon"), "required")
    assert.equal(keyField("hll_crcon"), "optional")
    assert.equal(keyField("wardogs_public_directory"), "hidden")
})

test("responses are read defensively and only as codes", () => {
    assert.deepEqual(
        readCommandResult(200, {
            ok: true,
            ref: "src-1",
            enabled: false,
            test: { outcome: "unauthorized" },
        }),
        {
            ok: true,
            enabled: false,
            error: null,
            retryAfterSeconds: null,
            test: "unauthorized",
        }
    )
    assert.deepEqual(
        readCommandResult(429, { error: "rate_limited", retryAfterMs: 1500 }),
        {
            ok: false,
            enabled: null,
            error: "rate_limited",
            retryAfterSeconds: 2,
            test: null,
        }
    )
    assert.equal(readCommandResult(500, "<html>").error, "unavailable")
    assert.equal(
        readCommandResult(400, { error: "something new" }).error,
        "unavailable"
    )
    assert.deepEqual(readCommandResult(200, { outcome: "ok" }).test, "ok")
})

test("placeholders are filled and unknown ones stay visible", () => {
    assert.equal(
        fill("Retry in {seconds} s ({x})", { seconds: 3 }),
        "Retry in 3 s ({x})"
    )
})
