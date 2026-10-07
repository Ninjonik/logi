import assert from "node:assert/strict"
import test from "node:test"

import { memberNames } from "./match-context"

const DISPLAY_ID = "100000000000000001"
const USERNAME_ID = "100000000000000002"

test("member names prefer the current Discord display name and fall back to the username", async () => {
    const guild = {
        members: {
            fetch: async ({ user }: { user: string[] }) => {
                assert.deepEqual(user, [DISPLAY_ID, USERNAME_ID])
                return new Map([
                    [
                        DISPLAY_ID,
                        {
                            displayName: "Petr the Great",
                            user: { username: "peterzatko" },
                        },
                    ],
                    [
                        USERNAME_ID,
                        {
                            displayName: "",
                            user: { username: "discord-user" },
                        },
                    ],
                ])
            },
        },
    }

    assert.deepEqual(
        await memberNames(guild as never, [DISPLAY_ID, USERNAME_ID], {
            [DISPLAY_ID]: "stale stored name",
        }),
        {
            [DISPLAY_ID]: "Petr the Great",
            [USERNAME_ID]: "discord-user",
        }
    )
})
