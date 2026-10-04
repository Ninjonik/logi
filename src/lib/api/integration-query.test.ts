import { parseIntegrationQuery } from "./integration-query"
import assert from "node:assert/strict"
import test from "node:test"

const request = (path: string) => new Request(`https://logi.test${path}`)

test("the teams feed accepts only directory games; Vietnam is invalid, not empty", () => {
    for (const game of ["hell_let_loose", "wardogs"]) {
        assert.equal(
            parseIntegrationQuery(
                request(
                    `/api/v1/clan/changes?game=${game}&resources=teams&start=now`
                )
            )?.kind,
            "changes",
            game
        )
        assert.equal(
            parseIntegrationQuery(
                request(`/api/v1/clan/sync-records/teams/team-1?game=${game}`)
            )?.kind,
            "record",
            game
        )
    }
    for (const path of [
        "/api/v1/clan/changes?game=hell_let_loose_vietnam&resources=teams&start=now",
        "/api/v1/clan/changes?game=hell_let_loose_vietnam&resources=event-summaries,teams&start=now",
        "/api/v1/clan/sync-records/teams/team-1?game=hell_let_loose_vietnam",
    ])
        assert.equal(parseIntegrationQuery(request(path)), null, path)
    // Other resources keep serving Vietnam.
    assert.equal(
        parseIntegrationQuery(
            request(
                "/api/v1/clan/changes?game=hell_let_loose_vietnam&resources=event-summaries&start=now"
            )
        )?.kind,
        "changes"
    )
})
