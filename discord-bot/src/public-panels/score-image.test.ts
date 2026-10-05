import {
    hllSample,
    wardogsSample,
} from "../../../src/domain/discord-publications/panel-image-samples"
import type { PanelImageRequest } from "../../../src/domain/discord-publications/panel-image-model"
import { createPanelImageSource, webPanelImageRequest } from "./score-image"
import assert from "node:assert/strict"
import test from "node:test"

function setup() {
    let now = Date.parse("2026-10-05T18:41:12Z")
    const requests: PanelImageRequest[] = []
    let fail = false
    const source = createPanelImageSource({
        now: () => now,
        request: async (request) => {
            requests.push(request)
            if (fail) throw new Error("web down")
            return new Uint8Array([requests.length])
        },
    })
    return {
        source,
        requests,
        advance: (ms: number) => (now += ms),
        fail: (value: boolean) => (fail = value),
    }
}

test("the first image renders with a versioned name and the board's alt text", async () => {
    const { source, requests } = setup()
    const image = await source.score("panel:1", hllSample)
    assert.ok(image)
    assert.match(image.name, /^skore-vlci1-2041-[0-9a-f]{6}\.png$/)
    assert.equal(image.fresh, true)
    assert.equal(
        image.description,
        "Obrázek skóre: Vlci #1 · Public, Foy, Warfare, Den, živě, zbývá 47 minut, 78 ze 100 hráčů a fronta 3, Spojenci 3 : 2 Osa, nejvíc zabití Rex_CZ 31, Hans_88 28, Bizon 27."
    )
    assert.equal(requests.length, 1)
})

test("unchanged content is never re-uploaded; changes wait for the 60 s window", async () => {
    const { source, requests, advance } = setup()
    const first = (await source.score("panel:1", hllSample))!
    advance(120_000)
    // Only the time stamp moved: same image, same name.
    const same = (await source.score("panel:1", {
        ...hllSample,
        renderedAt: "2026-10-05T18:43:12.000Z",
    }))!
    assert.equal(same.fresh, false)
    assert.equal(same.name, first.name)
    const changed = {
        ...hllSample,
        allies: { nation: "us" as const, score: 4 },
        axis: { nation: "ger" as const, score: 1 },
    }
    const next = (await source.score("panel:1", changed))!
    assert.equal(next.fresh, true)
    assert.notEqual(next.name, first.name)
    advance(30_000)
    const throttled = (await source.score("panel:1", {
        ...changed,
        players: { count: 80, capacity: 100, queue: 0 },
    }))!
    assert.equal(throttled.fresh, false)
    assert.equal(throttled.name, next.name)
    advance(30_000)
    const after = (await source.score("panel:1", {
        ...changed,
        players: { count: 80, capacity: 100, queue: 0 },
    }))!
    assert.equal(after.fresh, true)
    assert.equal(requests.length, 3)
    // Panels are independent.
    assert.equal((await source.score("panel:2", wardogsSample))?.fresh, true)
})

test("a failed render keeps the last image, or none; an invalid model is never sent", async () => {
    const { source, requests, advance, fail } = setup()
    fail(true)
    assert.equal(await source.score("panel:1", hllSample), null)
    fail(false)
    const ok = (await source.score("panel:1", hllSample))!
    fail(true)
    advance(61_000)
    const kept = (await source.score("panel:1", wardogsSample))!
    assert.equal(kept.name, ok.name)
    assert.equal(kept.fresh, false)
    const count = requests.length
    assert.equal(
        await source.score("panel:3", {
            ...hllSample,
            serverName: "bad\u0000name",
        }),
        null
    )
    assert.equal(requests.length, count)
})

test("banners re-render on change without the 60 s wait and are forgotten with the panel", async () => {
    const { source, requests } = setup()
    const banner = {
        version: 1 as const,
        language: "cs" as const,
        accentColor: "#e8a33d",
        clanTag: "VLK",
        clanName: "Vlci",
        subtitle: "Server #1 · Public · Hell Let Loose",
        background: null,
    }
    const a = (await source.banner(
        "panel:1",
        banner,
        "Vlci #1 · Public",
        "UTC"
    ))!
    assert.match(a.name, /^banner-vlci1-\d{4}-[0-9a-f]{6}\.png$/)
    const b = (await source.banner(
        "panel:1",
        { ...banner, clanTag: "WLF" },
        "Vlci #1 · Public",
        "UTC"
    ))!
    assert.equal(b.fresh, true)
    source.forget("panel:1")
    assert.equal(
        (
            await source.banner(
                "panel:1",
                { ...banner, clanTag: "WLF" },
                "Vlci #1 · Public",
                "UTC"
            )
        )?.fresh,
        true
    )
    assert.equal(requests.length, 3)
})

test("the web request carries the internal secret in the body and accepts only PNG", async () => {
    const sent: { url: string; body: unknown }[] = []
    const request = webPanelImageRequest({
        origin: "http://internal:3000",
        secret: "s3cret",
        fetch: (async (url: URL, init: RequestInit) => {
            sent.push({ url: String(url), body: JSON.parse(String(init.body)) })
            return new Response(new Uint8Array([1, 2]), {
                headers: { "content-type": "image/png" },
            })
        }) as unknown as typeof fetch,
    })
    const bytes = await request({ kind: "score", model: hllSample })
    assert.deepEqual(bytes, new Uint8Array([1, 2]))
    assert.equal(sent[0]!.url, "http://internal:3000/api/discord/panel-image")
    assert.deepEqual(sent[0]!.body, {
        secret: "s3cret",
        request: { kind: "score", model: hllSample },
    })
    const refused = webPanelImageRequest({
        origin: "http://internal:3000",
        secret: "s3cret",
        fetch: (async () =>
            Response.json(
                { error: "unauthorized" },
                { status: 401 }
            )) as unknown as typeof fetch,
    })
    await assert.rejects(refused({ kind: "score", model: hllSample }), /401/)
})
