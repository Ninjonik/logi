import { leaguePortalPaths } from "./league-portal-openapi"
import assert from "node:assert/strict"
import test from "node:test"
test("personal league commands require a personal session, never a clan service grant", () => {
    const route = leaguePortalPaths["/me/leagues"]
    assert.deepEqual(route.post.security, [{ dashboardSession: [] }])
    assert.deepEqual(route.get.security, route.post.security)
    assert.ok(route.post.responses["403"])
    assert.ok(
        route.post.description.includes(
            "External hosts never import statistics"
        )
    )
    assert.ok(route.post.requestBody.content["application/json"].schema.oneOf)
})
test("public league index has no account authentication or private reports", () => {
    const route = leaguePortalPaths["/public/leagues"].get
    assert.deepEqual(route.security, [])
    assert.ok(
        route.description.includes(
            "credentials, invitations and provisional score reports are excluded"
        )
    )
})
