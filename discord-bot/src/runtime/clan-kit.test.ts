import assert from "node:assert/strict"
import test from "node:test"

import type { MessageKitOptions } from "../ui/message-kit"
import { matchReplyKit } from "./clan-kit"

const SERVER = "900000000000000001"
const NAMED = "900000000000000002"

/** A clan kit that records which server it was asked about. */
function recordingKit() {
    const asked: Array<string | null | undefined> = []
    const kit = async (guildId: string | null | undefined) => {
        asked.push(guildId)
        return (
            guildId ? { language: "cs", style: null } : {}
        ) as MessageKitOptions
    }
    return { asked, kit }
}

test("a match reply keeps the match's clan language while its context is known", async () => {
    const { asked, kit } = recordingKit()
    assert.deepEqual(
        await matchReplyKit(
            {
                context: { config: { defaultLanguage: "de" } },
                guildId: SERVER,
                customIdGuildId: NAMED,
            },
            kit
        ),
        { language: "de" }
    )
    assert.deepEqual(asked, [])
})

test("with the match gone the server of the click gives the language, then the server a DM button names", async () => {
    // L1-B19, L2-B01.
    const server = recordingKit()
    assert.deepEqual(
        await matchReplyKit(
            { context: null, guildId: SERVER, customIdGuildId: NAMED },
            server.kit
        ),
        { language: "cs", style: null }
    )
    assert.deepEqual(server.asked, [SERVER])
    const dm = recordingKit()
    assert.deepEqual(
        await matchReplyKit(
            { context: null, guildId: null, customIdGuildId: NAMED },
            dm.kit
        ),
        { language: "cs", style: null }
    )
    assert.deepEqual(dm.asked, [NAMED])
    // A DM sent before its buttons named the server: English, as before.
    const old = recordingKit()
    assert.deepEqual(
        await matchReplyKit({ context: null, guildId: null }, old.kit),
        {}
    )
    assert.deepEqual(old.asked, [undefined])
})
