import assert from "node:assert/strict"
import test from "node:test"

import {
    DISCORD_LEVEL_ZERO_ATTACHMENT_MAX_BYTES,
    DISCORD_MESSAGE_MAX_UPLOAD_BYTES,
    isDiscordLevelZeroAttachmentSizeValid,
} from "./attachment-limits"

test("accepts level-0 Discord attachments up to 20 MiB", () => {
    assert.equal(
        isDiscordLevelZeroAttachmentSizeValid(
            DISCORD_LEVEL_ZERO_ATTACHMENT_MAX_BYTES
        ),
        true
    )
    assert.equal(
        isDiscordLevelZeroAttachmentSizeValid(
            DISCORD_LEVEL_ZERO_ATTACHMENT_MAX_BYTES + 1
        ),
        false
    )
})

test("keeps the Discord message request cap distinct from per-file limits", () => {
    assert.equal(DISCORD_MESSAGE_MAX_UPLOAD_BYTES, 25 * 1024 * 1024)
    assert.ok(
        DISCORD_MESSAGE_MAX_UPLOAD_BYTES >
            DISCORD_LEVEL_ZERO_ATTACHMENT_MAX_BYTES
    )
})
