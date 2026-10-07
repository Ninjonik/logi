import {
    hllSample,
    wardogsSample,
} from "@/domain/discord-publications/panel-image-samples"
import {
    panelImageHandler,
    PANEL_IMAGE_MAX_BODY_BYTES,
} from "./panel-image-route"
import type { PanelImageRequest } from "@/domain/discord-publications/panel-image-model"
import { createRosterImageCache } from "@/lib/roster-image-cache"
import assert from "node:assert/strict"
import test from "node:test"

const SECRET = "internal-secret-for-tests"
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])

function setup(render?: (request: PanelImageRequest) => Promise<Uint8Array>) {
    const calls: PanelImageRequest[] = []
    const handler = panelImageHandler({
        secret: () => SECRET,
        render: async (request) => {
            calls.push(request)
            return render ? render(request) : PNG
        },
        cache: createRosterImageCache(8),
    })
    return { handler, calls }
}
const post = (body: unknown, raw?: string) =>
    new Request("http://localhost/api/discord/panel-image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: raw ?? JSON.stringify(body),
    })
const score = { kind: "score", model: hllSample }

test("without the internal secret nothing is rendered or validated", async () => {
    const { handler, calls } = setup()
    for (const body of [
        { request: score },
        { secret: "wrong", request: score },
        { secret: SECRET.slice(0, -1), request: score },
        { secret: "", request: score },
        { secret: ["x"], request: score },
        // An invalid model with a wrong secret still answers 401, not 400.
        { secret: "wrong", request: { kind: "score", model: {} } },
    ]) {
        const response = await handler(post(body))
        assert.equal(response.status, 401)
        assert.deepEqual(await response.json(), { error: "unauthorized" })
        assert.equal(response.headers.get("cache-control"), "no-store")
    }
    assert.equal((await handler(post(null, "not json"))).status, 401)
    assert.equal(calls.length, 0)
})

test("an empty secret on the server never matches", async () => {
    const handler = panelImageHandler({
        secret: () => "",
        render: async () => PNG,
        cache: createRosterImageCache(1),
    })
    assert.equal(
        (await handler(post({ secret: "", request: score }))).status,
        401
    )
})

test("oversized bodies are refused before parsing", async () => {
    const { handler, calls } = setup()
    const padding = "x".repeat(PANEL_IMAGE_MAX_BODY_BYTES)
    const response = await handler(
        post({ secret: SECRET, request: score, padding })
    )
    assert.equal(response.status, 401)
    assert.equal(calls.length, 0)
})

test("an authenticated request with an invalid model is a 400 without details", async () => {
    const { handler, calls } = setup()
    for (const request of [
        { kind: "score", model: { ...hllSample, password: "hunter2" } },
        {
            kind: "score",
            model: {
                ...hllSample,
                background: { kind: "url", url: "http://169.254.169.254/" },
            },
        },
        {
            kind: "score",
            model: {
                ...hllSample,
                background: {
                    kind: "builtin",
                    game: "hell_let_loose",
                    mapKey: "../../etc/passwd",
                },
            },
        },
        { kind: "banner", model: hllSample },
        { kind: "other", model: hllSample },
        null,
    ]) {
        const response = await handler(post({ secret: SECRET, request }))
        assert.equal(response.status, 400)
        assert.deepEqual(await response.json(), { error: "invalid_request" })
    }
    assert.equal(calls.length, 0)
})

test("a valid request returns a private PNG with its content hash", async () => {
    const { handler, calls } = setup()
    const response = await handler(post({ secret: SECRET, request: score }))
    assert.equal(response.status, 200)
    assert.equal(response.headers.get("content-type"), "image/png")
    assert.equal(response.headers.get("cache-control"), "private, no-store")
    assert.equal(response.headers.get("x-content-type-options"), "nosniff")
    assert.match(
        response.headers.get("x-logi-image-hash") ?? "",
        /^[0-9a-f]{16}$/
    )
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), PNG)
    assert.equal(calls.length, 1)
    assert.equal(calls[0]!.kind, "score")
})

test("identical content is rendered once; only the time stamp changing reuses the image", async () => {
    const { handler, calls } = setup()
    await handler(post({ secret: SECRET, request: score }))
    const later = {
        kind: "score",
        model: { ...hllSample, renderedAt: "2026-10-05T18:42:12.000Z" },
    }
    const reused = await handler(post({ secret: SECRET, request: later }))
    assert.equal(reused.status, 200)
    assert.equal(calls.length, 1)
    await handler(
        post({
            secret: SECRET,
            request: { kind: "score", model: wardogsSample },
        })
    )
    assert.equal(calls.length, 2)
})

test("concurrent identical requests share one render", async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    const { handler, calls } = setup(async () => {
        await gate
        return PNG
    })
    const first = handler(post({ secret: SECRET, request: score }))
    const second = handler(post({ secret: SECRET, request: score }))
    await new Promise((resolve) => setTimeout(resolve, 10))
    release()
    const responses = await Promise.all([first, second])
    assert.deepEqual(
        responses.map((r) => r.status),
        [200, 200]
    )
    assert.equal(calls.length, 1)
})

test("a render failure is a 503 that reveals nothing and is not cached", async () => {
    let fail = true
    const { handler, calls } = setup(async () => {
        if (fail) throw new Error(`secret path /srv/${SECRET}`)
        return PNG
    })
    const failed = await handler(post({ secret: SECRET, request: score }))
    assert.equal(failed.status, 503)
    const text = await failed.text()
    assert.equal(text, JSON.stringify({ error: "render_failed" }))
    assert.equal(text.includes(SECRET), false)
    fail = false
    assert.equal(
        (await handler(post({ secret: SECRET, request: score }))).status,
        200
    )
    assert.equal(calls.length, 2)
})
