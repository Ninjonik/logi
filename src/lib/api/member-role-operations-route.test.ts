import { memberRoleOperationsSchema } from "../../domain/membership/role-operations"
import { memberRoleOperationsHandler } from "./member-role-operations-route"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
test("role audit lookup is session-only, tenant-bound, no-store and rechecks authority after reading", async () => {
    let authorized = true,
        changeDuringRead = false,
        calls = 0
    const handle = memberRoleOperationsHandler({
        authorize: async () => (authorized ? "trusted-guild" : null),
        list: async (guild) => {
            calls++
            assert.equal(guild, "trusted-guild")
            if (changeDuringRead) authorized = false
            return []
        },
    })
    const request = new Request(
        "https://logi.test/api/servers/workspace/member-role-operations?guildId=attacker"
    )
    const response = await handle(request, "workspace")
    assert.equal(response.status, 200)
    assert.equal(response.headers.get("cache-control"), "no-store")
    changeDuringRead = true
    assert.equal((await handle(request, "workspace")).status, 403)
    assert.equal((await handle(request, "workspace")).status, 403)
    assert.equal(calls, 2)
})

test("versioned operator fixtures obey the closed schema and invalid audit data is withheld", async () => {
    const fixture = JSON.parse(
        readFileSync(
            new URL(
                "../../../docs/integrations/website/v0.8/fixtures.json",
                import.meta.url
            ),
            "utf8"
        )
    )
    // The test file is under src/lib/api; fixture path is rooted at the repository.
    const rows = memberRoleOperationsSchema.parse(fixture)
    assert.equal(rows.length, 4)
    assert.equal(rows[0].userId, "imported-player")
    assert.equal(rows[0].discordUserId, "222222222222222222")
    assert.equal(rows[3].discordUserId, null)
    fixture[0].policyFingerprint = "private policy"
    const handle = memberRoleOperationsHandler({
        authorize: async () => "guild",
        list: async () => fixture,
    })
    const response = await handle(
        new Request("https://logi.test/audit"),
        "workspace"
    )
    assert.equal(response.status, 503)
    assert.equal((await response.text()).includes("private policy"), false)
})
