import {
    publish,
    type Publication,
} from "../../application/discord-publications/publish"
import { membershipPanelConfig, eventMessageIdentity } from "./legacy-bindings"
import assert from "node:assert/strict"
import test from "node:test"
test("two recruitment games sharing a channel never adopt each other's legacy message", () => {
    const base = {
        membershipPanelMessageId: "hll-message",
        membershipPanelLastConfigUpdatedAt: "old",
        membershipSettings: { submitChannelId: "same" },
    }
    const hll = membershipPanelConfig(base)
    const wardogs = membershipPanelConfig(base, {
        membershipSettings: { submitChannelId: "same" },
    })
    assert.equal(hll.membershipPanelMessageId, "hll-message")
    assert.equal(wardogs.membershipPanelMessageId, undefined)
    assert.equal(wardogs.membershipPanelLastConfigUpdatedAt, undefined)
    assert.equal(
        membershipPanelConfig(base, { membershipPanelMessageId: "wdg-message" })
            .membershipPanelMessageId,
        "wdg-message"
    )
})
test("legacy split-channel migration removes the known old message before creation; failed deletion preserves it", async () => {
    for (const forbidden of [false, true]) {
        const identity = eventMessageIdentity({
            eventId: "event",
            kind: "announcement",
            destination: "new",
            storedAnnouncementChannelId: "old",
            messageId: "legacy",
        })
        let state: Publication = {
            id: "binding",
            fence: 1,
            channelId: identity.legacyChannelId,
            messageId: identity.legacyMessageId!,
            pending: null,
            hash: null,
        }
        const messages = new Set(["old:legacy"])
        const operation = publish(
            {
                claim: async () => structuredClone(state),
                save: async (s) => {
                    state = structuredClone(s)
                },
                finish: async () => {},
            },
            {
                exists: async (channel, id) => messages.has(`${channel}:${id}`),
                recover: async () => null,
                create: async (channel) => {
                    messages.add(`${channel}:replacement`)
                    return "replacement"
                },
                edit: async () => {},
                remove: async (channel, id) => {
                    if (forbidden) throw Error("Forbidden")
                    messages.delete(`${channel}:${id}`)
                },
            },
            "new",
            "v1"
        )
        if (forbidden) {
            await assert.rejects(operation, /Forbidden/)
            assert.deepEqual([...messages], ["old:legacy"])
        } else {
            await operation
            assert.deepEqual([...messages], ["new:replacement"])
        }
    }
})
