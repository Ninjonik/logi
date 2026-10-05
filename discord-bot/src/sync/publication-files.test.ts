import { publicationFiles, componentAttachments } from "./publication-files"

test("Components V2 artwork retention reads the API's nested attachment identity", () => {
    const name = "logi-panel-zestafona-abcdef123456.webp"
    const components = [
        {
            type: 9,
            accessory: {
                media: {
                    attachment_id: "123456789012345678",
                    url: `https://cdn.discordapp.com/attachments/111/123456789012345678/${name}?expires=redacted`,
                },
            },
        },
    ]
    const retained = componentAttachments(components)
    assert.deepEqual(
        publicationFiles([{ attachment: "/catalog/map.webp", name }], retained),
        {
            files: [],
            attachments: [{ id: "123456789012345678", filename: name }],
        }
    )
    assert.deepEqual(
        componentAttachments({
            attachment_id: "123456789012345678",
            url: "https://untrusted.invalid/attachments/a/b",
        }),
        []
    )
})
import assert from "node:assert/strict"
import test from "node:test"

test("unchanged content-addressed artwork is retained instead of uploaded on every refresh", () => {
    const asset = {
        attachment: "/catalog/map.webp",
        name: "logi-panel-zestafona-abcdef123456.webp",
    }
    assert.deepEqual(
        publicationFiles([asset], [{ id: "existing", name: asset.name }]),
        { files: [], attachments: [{ id: "existing", filename: asset.name }] }
    )
    assert.deepEqual(
        publicationFiles(
            [asset],
            [{ id: "old", name: "logi-panel-zestafona-000000000000.webp" }]
        ),
        { files: [asset], attachments: [] }
    )
    assert.deepEqual(publicationFiles([], [{ id: "old", name: asset.name }]), {
        files: [],
        attachments: [],
    })
})
test("versioned panel images are kept while unchanged and uploaded when their hash changes", () => {
    const score = {
        attachment: Buffer.from("png"),
        name: "skore-vlci-1-3fa9c2.png",
    }
    assert.deepEqual(
        publicationFiles([score], [{ id: "kept", name: score.name }]),
        { files: [], attachments: [{ id: "kept", filename: score.name }] }
    )
    assert.deepEqual(
        publicationFiles(
            [score],
            [{ id: "old", name: "skore-vlci-1-000000.png" }]
        ),
        { files: [score], attachments: [] }
    )
    for (const name of ["banner-vlci-1-ab12.webp", "mapa-foy-0f.png"])
        assert.deepEqual(
            publicationFiles(
                [{ attachment: Buffer.from("x"), name }],
                [{ id: "kept", name }]
            ).attachments,
            [{ id: "kept", filename: name }]
        )
    // Not a versioned name: always uploaded again.
    const plain = { attachment: Buffer.from("x"), name: "skore.png" }
    assert.deepEqual(
        publicationFiles([plain], [{ id: "old", name: plain.name }]),
        { files: [plain], attachments: [] }
    )
})
test("arbitrary mutable filenames are never assumed identical", () => {
    const asset = { attachment: "/catalog/map.webp", name: "map.webp" }
    assert.deepEqual(
        publicationFiles([asset], [{ id: "old", name: asset.name }]),
        { files: [asset], attachments: [] }
    )
})
