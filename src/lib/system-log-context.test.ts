import { sanitizeLogContext } from "./system-log-context"
import assert from "node:assert/strict"
import test from "node:test"

test("log context handles cyclic errors/objects and redacts credential fields", () => {
    const error = new Error("failed")
    Object.assign(error, { cause: error })
    const context: Record<string, unknown> = {
        error,
        authorization: "Bearer private",
        nested: { access_token: "private", userId: "u1" },
    }
    context.self = context
    const result = sanitizeLogContext(context)
    const json = JSON.stringify(result)
    assert.ok(!json.includes("private"))
    assert.ok(json.includes("[circular]"))
    assert.ok(json.includes("u1"))
})

test("log context bounds deep/large values and survives throwing getters", () => {
    const result = sanitizeLogContext({
        values: Array.from({ length: 1000 }, () => "x".repeat(10000)),
    })
    assert.ok(JSON.stringify(result).length < 20000)
    const context = {
        get value() {
            throw new Error("unreadable")
        },
    }
    assert.deepEqual(sanitizeLogContext(context), { context: "[unreadable]" })
})
