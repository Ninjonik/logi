import assert from "node:assert/strict"
import test from "node:test"

import { resolveRosterAvatarUrl } from "./roster-image"

const resolveAssetUrl = (path?: string) => path

test("roster images replace animated Discord avatars with a static local fallback", () => {
    assert.equal(
        resolveRosterAvatarUrl(
            "https://cdn.discordapp.com/avatars/924041557596831796/a_21881837af76d4089adbf02b5a77553e.png?size=256",
            resolveAssetUrl
        ),
        "/favicon.png"
    )
})

test("roster images preserve static avatar URLs", () => {
    const avatar =
        "https://cdn.discordapp.com/avatars/924041557596831796/21881837af76d4089adbf02b5a77553e.png?size=256"

    assert.equal(resolveRosterAvatarUrl(avatar, resolveAssetUrl), avatar)
})
