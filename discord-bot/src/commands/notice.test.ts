import assert from "node:assert/strict"
import test from "node:test"

import {
    handleNoticeAutocomplete,
    handleNoticeCommand,
    handleNoticeModalSubmit,
    noticeInteractions,
    type NoticeEventContext,
    type NoticePorts,
    type NoticeTarget,
} from "./notice"
import {
    configsOf,
    fakeInteraction,
    testGuildConfig,
    TEST_GUILD,
    TEST_USER,
} from "./fake-interaction"
import {
    createInteractionRegistry,
    type InteractionFeatureContext,
} from "../interactions/registry"

const EVENT_ID = "events_vlk_rog"
const target: NoticeTarget = {
    id: EVENT_ID,
    name: "VLK vs ROG",
    categoryLabel: "Přátelák",
    gameStart: "2026-10-11T18:00:00Z",
}
const event: NoticeEventContext = {
    guildId: TEST_GUILD,
    language: "cs",
    timeZone: "Europe/Prague",
    name: "VLK vs ROG",
    gameStart: "2026-10-11T18:00:00Z",
    status: "scheduled",
    announcementsChannelId: "300000000000000003",
}

function ports(overrides: Partial<NoticePorts> = {}) {
    const saves: Array<[string, string, string]> = []
    const refreshed: string[] = []
    const value: NoticePorts = {
        configs: configsOf(testGuildConfig()),
        targets: async () => [target],
        event: async () => event,
        save: async (eventId, userId, reason) => {
            saves.push([eventId, userId, reason])
        },
        saved: async (_guildId, eventId) => {
            refreshed.push(eventId)
        },
        now: () => Date.parse("2026-10-11T16:00:00Z"),
        ...overrides,
    }
    return { ports: value, saves, refreshed }
}

type Modal = {
    toJSON(): {
        custom_id: string
        title: string
        components: Array<Record<string, unknown>>
    }
}

function commandInteraction(value: string) {
    const modals: Modal[] = []
    const f = fakeInteraction<Parameters<typeof handleNoticeCommand>[0]>({
        options: { getString: () => value },
        showModal: async (modal: Modal) => {
            modals.push(modal)
        },
    })
    return { ...f, modals }
}

function submit(
    reason: string,
    eventId = EVENT_ID,
    guildId: string | null = TEST_GUILD
) {
    return fakeInteraction<Parameters<typeof handleNoticeModalSubmit>[0]>({
        customId: `notice-modal:${eventId}`,
        guildId,
        fields: { getTextInputValue: () => reason },
    })
}

test("the akce autocomplete lists signed-up events with day and time in the clan's zone (M1-B10, M3-15)", async () => {
    let choices: unknown
    await handleNoticeAutocomplete(
        {
            guildId: TEST_GUILD,
            user: { id: TEST_USER },
            options: {
                getFocused: () => ({ name: "event", value: "vlk" }),
            },
            respond: async (value: unknown) => {
                choices = value
            },
        } as never,
        ports().ports
    )
    assert.deepEqual(choices, [
        { name: "VLK vs ROG · Přátelák · ne 11. 10. · 20:00", value: EVENT_ID },
    ])
})

test("/notice opens the Přijdu později window for the one matching event (M3-16)", async () => {
    const f = commandInteraction(EVENT_ID)
    await handleNoticeCommand(f.interaction, ports().ports)
    assert.equal(f.sent.length, 0, "the window is the first answer")
    const modal = f.modals[0]!.toJSON()
    assert.equal(modal.custom_id, `notice-modal:${EVENT_ID}`)
    assert.equal(modal.title, "Přijdu později · VLK vs ROG")
    const json = JSON.stringify(modal.components)
    assert.match(json, /Uvidí to jen velení zápasu\./)
    assert.match(json, /Kdy dorazíš a proč\?/)
    assert.match(json, /"max_length":500/)
})

test("several matches and no sign-up are the shared private cards (M3-18, M3-20)", async () => {
    const several = commandInteraction("vlk")
    await handleNoticeCommand(
        several.interaction,
        ports({
            targets: async () => [target, { ...target, id: "events_other" }],
        }).ports
    )
    assert.equal(several.modals.length, 0)
    assert.match(several.text(), /Takových akcí je víc/)
    assert.match(several.text(), /"flags":32832/)

    const none = commandInteraction("vlk")
    await handleNoticeCommand(
        none.interaction,
        ports({ targets: async () => [] }).ports
    )
    assert.match(none.text(), /Nejsi přihlášený na žádnou nadcházející akci/)
    assert.match(none.text(), /Přihlásíš se v <#300000000000000003>\./)
})

test("/notice for a signed-up event that already started answers 'už začal' at command time (M3-19)", async () => {
    const queries: string[] = []
    const late = commandInteraction("VLK vs ROG")
    await handleNoticeCommand(
        late.interaction,
        ports({
            targets: async () => [],
            started: async (guildId, userId, query) => {
                queries.push(`${guildId}:${userId}:${query}`)
                return { id: EVENT_ID, name: "VLK vs ROG" }
            },
        }).ports
    )
    assert.equal(late.modals.length, 0)
    assert.deepEqual(queries, [`${TEST_GUILD}:${TEST_USER}:VLK vs ROG`])
    assert.match(late.text(), /VLK vs ROG už začal/)
    assert.doesNotMatch(late.text(), /Nejsi přihlášený/)
    assert.match(late.text(), /"flags":32832/)

    // An upcoming match never asks for started ones; a failed read falls
    // back to the not-signed-up card.
    const upcoming = commandInteraction(EVENT_ID)
    await handleNoticeCommand(
        upcoming.interaction,
        ports({
            started: async () => {
                throw new Error("must not be read")
            },
        }).ports
    )
    assert.equal(upcoming.modals.length, 1)
    const failed = commandInteraction("VLK vs ROG")
    await handleNoticeCommand(
        failed.interaction,
        ports({
            targets: async () => [],
            started: async () => {
                throw new Error("unavailable")
            },
        }).ports
    )
    assert.match(failed.text(), /Nejsi přihlášený na žádnou nadcházející akci/)
})

test("saving quotes the reason privately and refreshes the match (M3-17, M3-B03)", async () => {
    const fake = ports()
    const f = submit("Kolem 20:30, končím v práci.")
    await handleNoticeModalSubmit(f.interaction, fake.ports)
    assert.deepEqual(fake.saves, [
        [EVENT_ID, TEST_USER, "Kolem 20:30, končím v práci."],
    ])
    assert.deepEqual(fake.refreshed, [EVENT_ID])
    const out = f.text()
    assert.match(out, /Velení ví, že přijdeš později/)
    assert.match(out, /VLK vs ROG · Přátelák · ne <t:\d+:d> · <t:\d+:t>/)
    assert.match(out, /> Kolem 20:30, končím v práci\./)
    assert.match(
        out,
        /Připomínky docházky k tomuto zápasu ti už chodit nebudou/
    )
    assert.equal(
        (f.interaction as unknown as { ephemeral: boolean }).ephemeral,
        true,
        "deferred privately"
    )
})

test("an event that started meanwhile gets its own card; the rule's refusal is mapped (M3-19)", async () => {
    const late = submit("Za hodinu")
    await handleNoticeModalSubmit(
        late.interaction,
        ports({
            targets: async () => [],
            now: () => Date.parse("2026-10-11T18:30:00Z"),
        }).ports
    )
    assert.match(late.text(), /VLK vs ROG už začal/)
    assert.match(late.text(), /Napiš velení přímo do kanálu zápasu/)

    const refused = submit("Za hodinu")
    await handleNoticeModalSubmit(
        refused.interaction,
        ports({
            save: async () => {
                throw new Error("Notices can only be sent before game start")
            },
        }).ports
    )
    assert.match(refused.text(), /VLK vs ROG už začal/)
    assert.doesNotMatch(refused.text(), /before game start/)
})

test("a saved notice asks for the post in the match thread; a refused one does not (L5-42..43)", async () => {
    const announced: Array<[string, string]> = []
    const announce = async (eventId: string, userId: string) => {
        announced.push([eventId, userId])
    }
    const saved = submit("Kolem 20:30")
    await handleNoticeModalSubmit(saved.interaction, ports({ announce }).ports)
    assert.deepEqual(announced, [[EVENT_ID, TEST_USER]])
    // A failing post never breaks the player's confirmation.
    const failing = submit("Kolem 20:30")
    await handleNoticeModalSubmit(
        failing.interaction,
        ports({
            announce: async () => {
                throw new Error("thread gone")
            },
        }).ports
    )
    assert.match(failing.text(), /Velení ví, že přijdeš později/)
    const refused = submit("Za hodinu")
    await handleNoticeModalSubmit(
        refused.interaction,
        ports({
            announce,
            save: async () => {
                throw new Error("Notices can only be sent before game start")
            },
        }).ports
    )
    assert.equal(announced.length, 1)
})

test("a modal from a DM saves with the event's server and language", async () => {
    const fake = ports({ configs: configsOf(null) })
    const f = submit("Kolem 20:30", EVENT_ID, null)
    await handleNoticeModalSubmit(f.interaction, fake.ports)
    assert.equal(fake.saves.length, 1)
    assert.match(f.text(), /Velení ví, že přijdeš později/)
})

test("/notice, its autocomplete and the window are registered; the reminder button belongs to the attendance replies", () => {
    const context: InteractionFeatureContext = {
        enqueueEventSync: () => {},
        triggerPollSoon: () => {},
    }
    const registry = createInteractionRegistry(
        [noticeInteractions(() => ports().ports)],
        context
    )
    assert.deepEqual(registry.routes().sort(), [
        "autocomplete:notice",
        "command:notice",
        "modal:notice-modal:",
    ])
})
