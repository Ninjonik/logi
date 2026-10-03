import { fetchOwnedPublicationMessage } from "./owned-message"
import assert from "node:assert/strict"
import test from "node:test"
test("publication existence bypasses cached messages; only fresh Unknown Message allows replacement", async () => {
    let code = 10008
    const channel = {
        messages: {
            fetch: async (options: unknown) => {
                if (
                    typeof options !== "object" ||
                    options === null ||
                    !("force" in options) ||
                    !options.force
                )
                    return { author: { id: "bot" } }
                throw { code }
            },
        },
    }
    assert.equal(
        await fetchOwnedPublicationMessage(channel as never, "message", "bot"),
        null
    )
    code = 50013
    await assert.rejects(
        fetchOwnedPublicationMessage(channel as never, "message", "bot"),
        (error) => (error as { code: number }).code === 50013
    )
    await assert.rejects(
        fetchOwnedPublicationMessage(
            {
                messages: {
                    fetch: async () => ({ author: { id: "someone-else" } }),
                },
            } as never,
            "message",
            "bot"
        ),
        /ownership/
    )
})
