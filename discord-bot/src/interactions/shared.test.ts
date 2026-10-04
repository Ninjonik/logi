import assert from "node:assert/strict"
import test from "node:test"

import { resolveSupportMemberIds } from "./shared"

test("ticket participants include category support members but not administrators", () => {
    const guild = {
        members: {
            cache: new Map([
                [
                    "support",
                    {
                        id: "support",
                        roles: { cache: new Map([["support-role", {}]]) },
                    },
                ],
                [
                    "dashboard-admin",
                    {
                        id: "dashboard-admin",
                        roles: {
                            cache: new Map([["dashboard-admin-role", {}]]),
                        },
                    },
                ],
                [
                    "discord-admin",
                    {
                        id: "discord-admin",
                        roles: { cache: new Map() },
                        permissions: { has: () => true },
                    },
                ],
            ]),
        },
    } as never

    assert.deepEqual(resolveSupportMemberIds(guild, ["support-role"]), [
        "support",
    ])
})
