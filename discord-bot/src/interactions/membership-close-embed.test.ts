import { getClanDiscordMessages } from "../../../src/lib/clan-language"
import { buildMembershipApplicationCloseEmbed } from "../interactions"
import { closeConvexClient } from "../convex"
import assert from "node:assert/strict"
import test, { after } from "node:test"

after(closeConvexClient)

for (const language of ["en", "cs"] as const) {
    test(`membership closure preserves the decision with a reason (${language})`, () => {
        const messages = getClanDiscordMessages(language)
        const embed = buildMembershipApplicationCloseEmbed({
            messages,
            applicationNumber: 42,
            closerId: "222222222222222222",
            closedAt: new Date("2026-10-04T00:00:00Z"),
            outcomeLabel: "Accepted member",
            reason: "Application reviewed",
        }).toJSON()
        const fields = new Map(
            embed.fields?.map((field) => [field.name, field.value])
        )
        assert.equal(
            fields.get(messages.membership.outcomeLabel),
            "Accepted member"
        )
        assert.equal(
            fields.get(messages.membership.reasonLabel),
            "Application reviewed"
        )
        assert.equal(
            fields.get(messages.membership.closedByLabel),
            "<@222222222222222222>"
        )
    })
}
