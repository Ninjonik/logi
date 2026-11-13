import { spawnSync } from "node:child_process"
import assert from "node:assert/strict"
import test from "node:test"

test("operator CLI help runs in the repository module format without backend configuration", () => {
    const result = spawnSync(
        process.execPath,
        ["--import", "tsx", "scripts/discord-reconciliation.ts", "--help"],
        {
            encoding: "utf8",
            env: {
                ...process.env,
                NEXT_PUBLIC_CONVEX_URL: "",
                CONVEX_URL: "",
                CONVEX_SELF_HOSTED_URL: "",
                INTERNAL_AUTH_SECRET: "",
            },
        }
    )
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /Commands: list, effects, audit/)
    assert.match(result.stdout, /resolve, resume/)
    assert.match(result.stdout, /team-delivery, team-audit, team-resolve/)
    assert.match(result.stdout, /recap-delivery, recap-audit, recap-resolve/)
    assert.match(
        result.stdout,
        /event-resources, resource-audit, resource-resolve/
    )
    assert.equal(result.stderr, "")
})
