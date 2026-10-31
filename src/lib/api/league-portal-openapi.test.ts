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
    assert.match(route.post.description, /linkTeam \(teamId, guildId\)/)
    assert.match(route.post.description, /one team across games/)
    assert.match(route.get.responses["200"].description, /eligible workspaces/)
    assert.match(
        route.post.description,
        /createAndEnroll accepts competitionId/
    )
    assert.match(route.post.description, /without a gameId/)
    assert.match(route.post.description, /multiple competitions/)
    assert.match(route.post.description, /expectedRevision/)
    assert.match(route.post.responses["200"].description, /registrationError/)
})

test("avatar uploads stay personal-session and team-scoped", () => {
    const route = leaguePortalPaths["/me/leagues/teams/{teamId}/logo"].post
    assert.deepEqual(route.security, [{ dashboardSession: [] }])
    assert.match(
        route.description,
        /Team ownership or linked-clan administrator access/
    )
    assert.match(route.description, /cannot be attached to another team/)
    assert.ok(route.requestBody.content["image/png"])
    assert.ok(route.responses["429"])
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
