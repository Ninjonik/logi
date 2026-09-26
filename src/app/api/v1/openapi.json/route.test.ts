import assert from "node:assert/strict"
import test from "node:test"

import { GET } from "./route"

test("OpenAPI advertises every implemented clan write endpoint", async () => {
    const response = await GET()
    const document = (await response.json()) as {
        paths: Record<string, Record<string, unknown>>
    }

    assert.ok(document.paths["/clan/articles"]?.post)
    assert.ok(document.paths["/clan/articles/{id}"]?.patch)
    assert.ok(document.paths["/clan/articles/{id}"]?.delete)
    assert.ok(document.paths["/clan/events/{eventId}/signup"]?.post)
    assert.ok(document.paths["/clan/events"]?.post)
    assert.ok(document.paths["/clan/events/{id}"]?.patch)
    assert.ok(document.paths["/clan/events/{eventId}/actions/conclude"]?.post)
    assert.ok(document.paths["/clan/groups"]?.post)
    assert.ok(document.paths["/clan/groups/{id}"]?.patch)
    assert.ok(document.paths["/clan/groups/{id}"]?.delete)
    assert.ok(document.paths["/clan/calendar-items"]?.post)
    assert.ok(document.paths["/clan/calendar-items/{id}"]?.patch)
    assert.ok(document.paths["/clan/calendar-items/{id}"]?.delete)
    assert.ok(document.paths["/clan/settings"]?.patch)
    assert.ok(document.paths["/clan/assignments"]?.post)
    assert.ok(document.paths["/clan/assignments/{id}"]?.patch)
    assert.ok(document.paths["/clan/assignments/{id}"]?.delete)
    assert.ok(document.paths["/clan/rosters/{id}"]?.patch)
    assert.ok(document.paths["/clan/rosters/{id}"]?.delete)
    assert.ok(document.paths["/clan/stratmaps"]?.post)
    assert.ok(document.paths["/clan/stratmaps/{id}"]?.patch)
    assert.ok(document.paths["/clan/topic-presets"]?.post)
    assert.ok(document.paths["/clan/topic-presets/{id}"]?.patch)
    assert.ok(document.paths["/clan/squad-presets"]?.post)
    assert.ok(document.paths["/clan/squad-presets/{id}"]?.patch)
})

test("OpenAPI requires idempotency for clan writes", async () => {
    const document = (await (await GET()).json()) as {
        paths: Record<
            string,
            Record<string, { parameters?: Array<{ name?: string }> }>
        >
    }
    const paths = [
        ["/clan/articles", "post"],
        ["/clan/articles/{id}", "patch"],
        ["/clan/events/{eventId}/signup", "post"],
        ["/clan/events", "post"],
        ["/clan/events/{id}", "patch"],
        ["/clan/events/{eventId}/actions/conclude", "post"],
        ["/clan/groups", "post"],
        ["/clan/calendar-items", "post"],
        ["/clan/settings", "patch"],
        ["/clan/assignments", "post"],
        ["/clan/assignments/{id}", "patch"],
        ["/clan/assignments/{id}", "delete"],
        ["/clan/rosters/{id}", "patch"],
        ["/clan/rosters/{id}", "delete"],
        ["/clan/stratmaps", "post"],
        ["/clan/stratmaps/{id}", "patch"],
        ["/clan/topic-presets", "post"],
        ["/clan/topic-presets/{id}", "patch"],
        ["/clan/squad-presets", "post"],
        ["/clan/squad-presets/{id}", "patch"],
    ] as const
    for (const [path, method] of paths)
        assert.ok(
            document.paths[path]?.[method]?.parameters?.some(
                (parameter) => parameter.name === "Idempotency-Key"
            )
        )
})
