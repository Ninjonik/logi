import { createInteractionHandler } from "../interactions"
import type { ButtonInteraction } from "discord.js"
import { ConvexReactClient } from "convex/react"
import { closeConvexClient } from "../convex"
import test, { afterEach } from "node:test"
import assert from "node:assert/strict"

afterEach(closeConvexClient)

for (const [action, expected] of [
    ["unsubscribe", false],
    ["subscribe", true],
] as const) {
    test(`actual ${action} button persists ${expected} for the clicking Discord subject`, async (t) => {
        const mutations: unknown[] = []
        t.mock.method(
            ConvexReactClient.prototype,
            "mutation",
            async (_reference: unknown, args: unknown) => {
                mutations.push(args)
            }
        )
        let response:
            | {
                  content: string
                  components: {
                      toJSON(): {
                          components: { custom_id?: string; label?: string }[]
                      }
                  }[]
              }
            | undefined
        await createInteractionHandler({
            enqueueEventSync: () => {},
            triggerPollSoon: () => {},
        }).handleButtonInteraction({
            customId: `match-recap:${action}`,
            locale: "cs",
            user: { id: "222222222222222222" },
            update: async (value: typeof response) => {
                response = value
            },
        } as unknown as ButtonInteraction)
        assert.deepEqual(mutations, [
            {
                secret: "dev-internal-auth-secret",
                userId: "222222222222222222",
                enabled: expected,
            },
        ])
        assert.ok(response)
        assert.equal(
            response.components[0].toJSON().components[0].custom_id,
            `match-recap:${expected ? "unsubscribe" : "subscribe"}`
        )
        assert.match(response.content, expected ? /přihlášen/ : /odhlášen/)
    })
}

test("unknown recap actions cannot change the notification preference", async (t) => {
    t.mock.method(ConvexReactClient.prototype, "mutation", async () =>
        assert.fail("Invalid control must not mutate")
    )
    let rejected = false
    await createInteractionHandler({
        enqueueEventSync: () => {},
        triggerPollSoon: () => {},
    }).handleButtonInteraction({
        customId: "match-recap:unknown-subscribe",
        locale: "en-US",
        user: { id: "222222222222222222" },
        reply: async () => {
            rejected = true
        },
    } as unknown as ButtonInteraction)
    assert.equal(rejected, true)
})
