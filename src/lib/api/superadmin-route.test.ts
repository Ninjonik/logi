import {
    isSameOrigin,
    superadminAccess,
    superadminCommandResponse,
    superadminErrorStatus,
} from "./superadmin-route"
import { platformImageAccess } from "./platform-image-access"
import assert from "node:assert/strict"
import test from "node:test"

const actor = (superadmin: boolean) => ({
    sid: "sid-1",
    subject: "100000000000000001",
    userRecordId: "user-1",
    superadmin,
})

test("only an attested superadmin actor gets global-administration access", () => {
    assert.deepEqual(superadminAccess(actor(true), "secret"), {
        secret: "secret",
        actor: actor(true),
    })
    assert.equal(superadminAccess(actor(false), "secret"), null)
    assert.equal(superadminAccess(null, "secret"), null)
})

test("platform image access always targets the platform scope", () => {
    assert.deepEqual(platformImageAccess(actor(true), "secret"), {
        secret: "secret",
        actor: actor(true),
        guildId: "platform",
    })
    assert.equal(platformImageAccess(actor(false), "secret"), null)
    assert.equal(platformImageAccess(null, "secret"), null)
})

test("maps conflicts to 409, missing records to 404 and other refusals to 400", () => {
    for (const code of [
        "duplicate_name",
        "revision_conflict",
        "idempotency_conflict",
        "archived",
        "not_archived",
        "not_pending",
    ])
        assert.equal(superadminErrorStatus(code), 409, code)
    assert.equal(superadminErrorStatus("not_found"), 404)
    for (const code of [
        "invalid_team",
        "invalid_merge",
        "team_archived",
        "team_game_mismatch",
        "asset_unavailable",
        "limit_reached",
        "invalid_decision",
    ])
        assert.equal(superadminErrorStatus(code), 400, code)
})

test("command results pass existingId through and successes unchanged", () => {
    assert.deepEqual(
        superadminCommandResponse({
            error: "duplicate_name",
            existingId: "team-2",
            extra: "dropped",
        }),
        { body: { error: "duplicate_name", existingId: "team-2" }, status: 409 }
    )
    assert.deepEqual(superadminCommandResponse({ error: "not_found" }), {
        body: { error: "not_found" },
        status: 404,
    })
    assert.deepEqual(superadminCommandResponse({ ok: true, revision: 3 }), {
        body: { ok: true, revision: 3 },
        status: 200,
    })
})

test("same-origin check compares the Origin header with the request URL", () => {
    const at = (origin?: string) =>
        new Request("https://logi.test/api/superadmin/teams", {
            method: "POST",
            headers: origin ? { origin } : {},
        })
    const site = "https://logi.test"
    assert.equal(isSameOrigin(at("https://logi.test"), site), true)
    assert.equal(isSameOrigin(at("https://evil.test"), site), false)
    assert.equal(isSameOrigin(at(), site), false)
    // Behind a proxy the request URL is internal; only the public origin counts.
    const internal = new Request("http://127.0.0.1:3000/api/superadmin/teams", {
        method: "POST",
        headers: { origin: "http://127.0.0.1:3000" },
    })
    assert.equal(isSameOrigin(internal, site), false)
})
