import { resolveLinkedPlayer } from "./player-link"
import assert from "node:assert/strict"
import test from "node:test"
test("unverified platform ID remains unresolved; revoked and ambiguous proofs do not attribute", () => {
    const id = "76561198000000001"
    const proof = {
        platform: "steam",
        platformId: id,
        logiUserId: "player",
        method: "steam_openid",
        verifiedAt: 1,
        revokedAt: null,
    }
    assert.equal(
        resolveLinkedPlayer("steam", id, [{ platformIds: [id] }]).logiUserId,
        null
    )
    assert.equal(resolveLinkedPlayer("steam", id, [proof]).logiUserId, "player")
    assert.equal(
        resolveLinkedPlayer("steam", id, [{ ...proof, revokedAt: 2 }])
            .logiUserId,
        null
    )
    assert.equal(resolveLinkedPlayer("xbox", id, [proof]).logiUserId, null)
    assert.equal(
        resolveLinkedPlayer("steam", id, [
            proof,
            { ...proof, logiUserId: "other" },
        ]).logiUserId,
        null
    )
})
