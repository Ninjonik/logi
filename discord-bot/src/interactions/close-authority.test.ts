import assert from "node:assert/strict"
import test from "node:test"

import { PermissionFlagsBits } from "discord.js"

import {
    checkCloseAuthority,
    type CloseAuthorityGuild,
} from "./close-authority"

function guild(
    member: { administrator?: boolean; roles?: string[] } | Error,
    calls: string[] = []
): CloseAuthorityGuild {
    return {
        fetch: async () => {
            calls.push("guild")
            return {
                roles: {
                    fetch: async () => {
                        calls.push("roles")
                    },
                },
                members: {
                    fetch: async (options) => {
                        calls.push(`member:${options.user}:${options.force}`)
                        if (member instanceof Error) throw member
                        return {
                            permissions: {
                                has: (permission: bigint) =>
                                    permission ===
                                        PermissionFlagsBits.Administrator &&
                                    Boolean(member.administrator),
                            },
                            roles: {
                                cache: new Map(
                                    (member.roles ?? []).map((id) => [id, {}])
                                ),
                            },
                        }
                    },
                },
            }
        },
    }
}
const policy = {
    dashboardAdminRoleId: "logi-admin",
    supportRoleIds: ["support"],
}

test("the guild, role definitions and member are read fresh before deciding", async () => {
    const calls: string[] = []
    assert.equal(
        await checkCloseAuthority(
            guild({ roles: ["support"] }, calls),
            "42",
            policy
        ),
        "allowed"
    )
    assert.deepEqual(calls, ["guild", "roles", "member:42:true"])
})

test("administrators and Logi admins may close; others may not", async () => {
    assert.equal(
        await checkCloseAuthority(guild({ administrator: true }), "1", policy),
        "allowed"
    )
    assert.equal(
        await checkCloseAuthority(
            guild({ roles: ["logi-admin"] }),
            "1",
            policy
        ),
        "allowed"
    )
    assert.equal(
        await checkCloseAuthority(guild({ roles: ["member"] }), "1", policy),
        "denied"
    )
    assert.equal(
        await checkCloseAuthority(guild({ roles: ["support"] }), "1", {
            supportRoleIds: null,
        }),
        "denied"
    )
})

test("authority that cannot be read is never assumed", async () => {
    assert.equal(
        await checkCloseAuthority(
            guild(new Error("Discord down")),
            "1",
            policy
        ),
        "unverifiable"
    )
    assert.equal(await checkCloseAuthority(null, "1", policy), "unverifiable")
})
