import { IMAGE_MAX_INPUT_BYTES } from "@/domain/assets/image-asset"
import { createPanelAssetLoader } from "./asset-source"
import assert from "node:assert/strict"
import test from "node:test"

const ID = "0123456789abcdef0123456789abcdef"

function loader(response: () => Response, known = true) {
    const resolved: string[] = []
    const fetched: string[] = []
    const load = createPanelAssetLoader({
        resolve: async (publicId) => {
            resolved.push(publicId)
            return known
                ? {
                      url: "https://storage.test/blob",
                      contentType: "image/webp",
                  }
                : null
        },
        fetchStorage: async (url) => {
            fetched.push(url)
            return response()
        },
    })
    return { load, resolved, fetched }
}

test("only a resolved 32-hex public ID is fetched, from the recorded storage URL", async () => {
    const { load, resolved, fetched } = loader(
        () => new Response(new Uint8Array([1, 2, 3]))
    )
    assert.deepEqual(await load(ID), new Uint8Array([1, 2, 3]))
    assert.deepEqual(fetched, ["https://storage.test/blob"])
    for (const bad of ["https://evil.test/x.png", "../x", "ABC", ""])
        assert.equal(await load(bad), null)
    assert.deepEqual(resolved, [ID])
})

test("unknown, failed and oversized assets yield no background", async () => {
    assert.equal(await loader(() => new Response("x"), false).load(ID), null)
    assert.equal(
        await loader(() => new Response("x", { status: 404 })).load(ID),
        null
    )
    assert.equal(
        await loader(
            () =>
                new Response("x", {
                    headers: {
                        "content-length": String(IMAGE_MAX_INPUT_BYTES + 1),
                    },
                })
        ).load(ID),
        null
    )
    // A body without a length header is still cut off at the bound.
    const big = new ReadableStream<Uint8Array>({
        pull(controller) {
            controller.enqueue(new Uint8Array(512 * 1024))
        },
    })
    assert.equal(await loader(() => new Response(big)).load(ID), null)
    const failing = createPanelAssetLoader({
        resolve: async () => {
            throw new Error("down")
        },
        fetchStorage: async () => new Response("x"),
    })
    assert.equal(await failing(ID), null)
})
