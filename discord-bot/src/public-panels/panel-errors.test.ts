import assert from "node:assert/strict"
import test from "node:test"

import { InvalidMessageViewError } from "../../../src/domain/discord-messages/message-validation"
import { classifyPanelError, PanelPassError } from "./panel-errors"
import { PublicationChannelError } from "../sync/publication"

const now = 1_000
const discord = (code: number | string, status?: number) =>
    Object.assign(new Error("DiscordAPIError[50013]: Missing Permissions"), {
        code,
        ...(status ? { status } : {}),
    })

test("Discord failures become codes the dashboard explains", () => {
    assert.deepEqual(classifyPanelError(discord(10004), now), {
        code: "bot_not_in_server",
        at: now,
    })
    assert.deepEqual(classifyPanelError(discord(10003), now), {
        code: "channel_missing",
        at: now,
    })
    assert.deepEqual(classifyPanelError(discord(50001), now), {
        code: "missing_permissions",
        at: now,
        permissions: ["view_channel"],
    })
    assert.equal(
        classifyPanelError(discord("x", 503), now)?.code,
        "discord_unavailable"
    )
    assert.equal(
        classifyPanelError(discord("ETIMEDOUT"), now)?.code,
        "discord_unavailable"
    )
})

test("the cause chain is followed and permission names are mapped", () => {
    const wrapped = Object.assign(new Error("Publication not sent."), {
        cause: new PublicationChannelError("missing_permissions", [
            "SendMessages",
            "SendMessages",
            "Unknown",
        ]),
    })
    assert.deepEqual(classifyPanelError(wrapped, now), {
        code: "missing_permissions",
        at: now,
        permissions: ["send_messages"],
    })
    assert.deepEqual(
        classifyPanelError(
            new PanelPassError("provider_rate_limited", "rate_limited"),
            now
        ),
        { code: "provider_rate_limited", at: now, category: "rate_limited" }
    )
})

test("an invalid view is a render failure; a busy lease is not an error at all", () => {
    assert.equal(
        classifyPanelError(
            new InvalidMessageViewError([
                { code: "too-long", detail: "x" },
            ] as never),
            now
        )?.code,
        "render_failed"
    )
    assert.equal(
        classifyPanelError(
            new Error("Publication busy or configuration changed; retry."),
            now
        ),
        null
    )
    assert.equal(
        classifyPanelError(new Error("Delivery uncertain; recovering."), now)
            ?.code,
        "delivery_uncertain"
    )
})

test("anything else is unknown, without the internal message", () => {
    const failure = classifyPanelError(new Error("token=abc leaked"), now)
    assert.deepEqual(failure, { code: "unknown", at: now })
})
