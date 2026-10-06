import assert from "node:assert/strict"
import test from "node:test"

import {
    type ButtonInteraction,
    type ChatInputCommandInteraction,
    type ModalSubmitInteraction,
    type StringSelectMenuInteraction,
} from "discord.js"

import {
    handleLinkCommand,
    handleLinkComponent,
    handleLinkIdModal,
    handleLinkSearchModal,
    linkInteractions,
    type LinkPorts,
} from "./link"
import {
    configsOf,
    fakeInteraction,
    testGuildConfig,
} from "../commands/fake-interaction"
import type { PreviousPlayer } from "../../../src/domain/membership/previous-players"
import { createInteractionRegistry } from "./registry"

const STEAM = "76561198000000017"

type Calls = { link: string[]; unlink: string[]; continued: string[] }

function ports(
    input: {
        accounts?: string[]
        /** The clan's servers retained games ("Hrál jsi u nás?"). */
        history?: boolean
        hits?: PreviousPlayer[] | "unavailable"
        taken?: boolean
        disabled?: boolean
        application?: { answers: Array<{ value: string }> } | null
        continueApplication?: boolean
    } = {},
    calls: Calls = { link: [], unlink: [], continued: [] }
): LinkPorts {
    let accounts = [...(input.accounts ?? [])]
    return {
        configs: configsOf(
            testGuildConfig(
                input.disabled
                    ? { commandSettings: { link: { enabled: false } } }
                    : {}
            )
        ),
        accounts: async () => accounts,
        link: async ({ stored }) => {
            calls.link.push(stored)
            if (input.taken) return "taken"
            accounts = [...accounts, stored]
            return "linked"
        },
        unlink: async (_userId, stored) => {
            calls.unlink.push(stored)
            accounts = accounts.filter((value) => value !== stored)
            return accounts
        },
        context: async () => ({
            application: input.application ?? null,
        }),
        playerHistory: async (_guildId, query) => {
            if (input.hits === "unavailable" && query)
                throw new Error("Convex unavailable")
            return {
                known: input.history ?? false,
                players:
                    query && input.hits !== "unavailable"
                        ? (input.hits ?? [])
                        : [],
            }
        },
        emoji: async () => ({}),
        siteUrl: "https://logi.example",
        ...(input.continueApplication
            ? {
                  continueApplication: async (_interaction, draftId) => {
                      calls.continued.push(draftId)
                  },
              }
            : {}),
    }
}

function component<T>(fields: Record<string, unknown>) {
    const modals: unknown[] = []
    const f = fakeInteraction<T>({
        update: async (value: unknown) => {
            f.sent.push({ kind: "edit", value })
        },
        showModal: async (modal: { toJSON(): unknown }) => {
            modals.push(modal.toJSON())
        },
        isStringSelectMenu: () => "values" in fields,
        user: {
            id: "100000000000000017",
            username: "hrac17",
            globalName: "Hráč 17",
            displayAvatarURL: () => "https://cdn.example/a.png",
        },
        ...fields,
    })
    return { ...f, modals: () => JSON.stringify(modals) }
}

function modal(customId: string, values: Record<string, string>) {
    return component<ModalSubmitInteraction>({
        customId,
        isFromMessage: () => true,
        fields: { getTextInputValue: (id: string) => values[id] ?? "" },
    })
}

test("/link with nothing linked: the platforms, the declaration and 'Ověřit Steam na webu' (L4-46..48)", async () => {
    const f = component<ChatInputCommandInteraction>({ commandName: "link" })
    await handleLinkCommand(f.interaction, ports())
    const text = f.last()
    assert.match(text, /HERNÍ ÚČTY/)
    assert.match(text, /### Propoj svůj herní účet/)
    assert.match(text, /Vyber platformu/)
    assert.match(
        text,
        /"label":"Steam","value":"steam","description":"Steam64 ID, 17 číslic"/
    )
    assert.match(text, /Je to tvoje prohlášení, ne ověření vlastnictví/)
    assert.match(text, /Ověřit Steam na webu/)
    assert.match(text, /https:\/\/logi\.example\/cs\/dashboard\/settings\/user/)
    assert.doesNotMatch(f.text(), /Platform ID|platform ID|DM odkaz/)
})

test("with retained games /link asks 'Hrál jsi u nás?' first (L4-49, L4-B08)", async () => {
    const f = component<ChatInputCommandInteraction>({ commandName: "link" })
    await handleLinkCommand(f.interaction, ports({ history: true }))
    assert.match(f.last(), /Hrál jsi už na serverech klanu\?/)
    assert.match(f.last(), /Ano, najděte mě/)
    assert.match(f.last(), /Ne, zadám ID/)
})

test("/link with linked accounts lists them with add and unlink (L4-54)", async () => {
    const f = component<ChatInputCommandInteraction>({ commandName: "link" })
    await handleLinkCommand(
        f.interaction,
        ports({ accounts: [`steam:${STEAM}`, "xbox:Hrac17CZ"] })
    )
    const text = f.last()
    assert.match(text, /### Tvoje propojené účty/)
    assert.match(text, /Steam propojený/)
    assert.match(text, /\*\*Xbox\*\* · Hrac17CZ/)
    assert.match(text, /"label":"Přidat další účet","disabled":false,"style":1/)
    assert.match(text, /"label":"Odpojit účet","disabled":false,"style":4/)
})

test("/link switched off on the Příkazy page answers with the shared card", async () => {
    const f = component<ChatInputCommandInteraction>({ commandName: "link" })
    await handleLinkCommand(f.interaction, ports({ disabled: true }))
    assert.match(f.text(), /\/link/)
    assert.doesNotMatch(f.text(), /Propoj svůj herní účet/)
})

test("choosing Steam shows the guide, its button opens 'Propojit Steam' (L4-52, L4-53, M3-10)", async () => {
    const select = component<StringSelectMenuInteraction>({
        customId: "link:l:platform",
        values: ["steam"],
    })
    await handleLinkComponent(select.interaction, ports())
    assert.match(select.last(), /Najdi své Steam64 ID/)
    assert.match(select.last(), /Zadat Steam64 ID/)
    assert.match(select.last(), /help\.steampowered\.com/)
    assert.match(select.last(), /"custom_id":"link:l:back"/)

    const enter = component<ButtonInteraction>({
        customId: "link:l:enter:steam",
    })
    await handleLinkComponent(enter.interaction, ports())
    const json = enter.modals()
    assert.match(json, /"title":"Propojit Steam"/)
    assert.match(json, /"label":"Steam64 ID"/)
    assert.match(json, /"placeholder":"76561198…"/)
    assert.match(json, /"required":true/)
    assert.match(json, /"custom_id":"link-modal:l:steam"/)
})

test("an invalid Steam64 is refused with 'Zadat znovu' and the guide (L4-56, M3-11, M3-B08)", async () => {
    const calls: Calls = { link: [], unlink: [], continued: [] }
    const f = modal("link-modal:l:steam", { id: "Hráč 17" })
    await handleLinkIdModal(f.interaction, ports({}, calls))
    assert.deepEqual(calls.link, [])
    assert.match(f.last(), /Tohle nevypadá jako Steam64 ID/)
    assert.match(
        f.last(),
        /Má 17 číslic a začíná 7656119\. Najdeš ho podle návodu\./
    )
    assert.match(
        f.last(),
        /"label":"Zadat znovu","disabled":false,"style":1,"custom_id":"link:l:enter:steam"/
    )
    assert.match(f.last(), /"label":"Návod"/)
})

test("a valid Steam64 is stored and 'Steam je propojený' lists the accounts (M3-09, L4-B07)", async () => {
    const calls: Calls = { link: [], unlink: [], continued: [] }
    const f = modal("link-modal:l:steam", {
        id: `https://steamcommunity.com/profiles/${STEAM}`,
    })
    await handleLinkIdModal(
        f.interaction,
        ports({ accounts: ["xbox:Hrac17CZ"] }, calls)
    )
    assert.deepEqual(calls.link, [`steam:${STEAM}`])
    assert.match(f.last(), /### Steam je propojený/)
    assert.match(f.last(), /Logi tě teď spáruje s tvými hrami a statistikami\./)
    assert.match(f.last(), new RegExp(`\\*\\*Steam\\*\\* · ${STEAM}`))
})

test("an ID another player has is refused in Czech", async () => {
    const f = modal("link-modal:l:xbox", { id: "Hrac17CZ" })
    await handleLinkIdModal(f.interaction, ports({ taken: true }))
    assert.match(f.last(), /Tohle ID už má propojené jiný hráč/)
})

test("'Ano, najděte mě' opens the search; results show last game and server (L4-50, L4-51)", async () => {
    const yes = component<StringSelectMenuInteraction>({
        customId: "link:l:played",
        values: ["yes"],
    })
    await handleLinkComponent(yes.interaction, ports({ history: true }))
    assert.match(yes.modals(), /"title":"Najít mě ve hře"/)
    assert.match(yes.modals(), /"label":"Jméno ve hře nebo ID"/)
    assert.match(yes.modals(), /"placeholder":"Napiš aspoň 3 znaky"/)
    assert.match(yes.modals(), /"min_length":3/)

    const f = modal("link-search:l", { query: "Hráč" })
    const day = 24 * 60 * 60 * 1000
    await handleLinkSearchModal(
        f.interaction,
        ports({
            history: true,
            // The same rows the application's "Našli jsme tě…" reads.
            hits: [
                {
                    key: `steam:${STEAM}`,
                    name: "Hráč 17",
                    platform: "steam",
                    platformId: STEAM,
                    lastSeenAt: new Date(Date.now() - 2 * day).toISOString(),
                    serverName: "Vlci #1",
                },
                {
                    key: "epic:2f1e0d9c8b7a69584736251403f2e1d0",
                    name: "Hrac17_CZ",
                    platform: "epic",
                    platformId: "2f1e0d9c8b7a69584736251403f2e1d0",
                    lastSeenAt: new Date(Date.now() - 24 * day).toISOString(),
                    serverName: "Vlci #2",
                },
            ],
        })
    )
    assert.match(f.last(), /Vyber se ze seznamu/)
    // The weekday only for the recent date (L4-51).
    assert.match(
        f.last(),
        /"description":"Steam · naposledy [a-zčřšžýáíéůú]{2} \d{1,2}\. \d{1,2}\. na Vlci #1"/
    )
    assert.match(
        f.last(),
        /"description":"Epic Games · naposledy \d{1,2}\. \d{1,2}\. na Vlci #2"/
    )
    assert.match(f.last(), new RegExp(`"value":"steam:${STEAM}"`))
    assert.match(f.last(), /Hráči, kteří hráli na serverech klanu\./)
    assert.match(f.last(), /Hledat znovu/)
    assert.match(f.last(), /Zadat ID ručně/)

    const none = modal("link-search:l", { query: "Nikdo" })
    await handleLinkSearchModal(none.interaction, ports({ history: true }))
    assert.match(none.last(), /Na serverech klanu jsme tě nenašli/)

    const down = modal("link-search:l", { query: "Hráč" })
    await handleLinkSearchModal(
        down.interaction,
        ports({ history: true, hits: "unavailable" })
    )
    assert.match(down.last(), /Hledání teď nejde/)
})

test("picking yourself links the found ID", async () => {
    const calls: Calls = { link: [], unlink: [], continued: [] }
    const f = component<StringSelectMenuInteraction>({
        customId: "link:l:pick",
        values: [`steam:${STEAM}`],
    })
    await handleLinkComponent(f.interaction, ports({}, calls))
    assert.deepEqual(calls.link, [`steam:${STEAM}`])
    assert.match(f.last(), /Steam je propojený/)
})

test("unlinking warns about the application and removes the chosen account (L4-55, L4-B09)", async () => {
    const calls: Calls = { link: [], unlink: [], continued: [] }
    const accounts = ["xbox:Hrac17CZ", `steam:${STEAM}`]
    const open = component<ButtonInteraction>({ customId: "link:l:unlink" })
    await handleLinkComponent(
        open.interaction,
        ports(
            {
                accounts,
                application: { answers: [{ value: `Steam ${STEAM}` }] },
            },
            calls
        )
    )
    assert.match(open.last(), /Který účet odpojit\?/)
    assert.match(
        open.last(),
        /"label":"Xbox · Hrac17CZ","value":"xbox:Hrac17CZ","description":"Statistiky z tohoto účtu se přestanou párovat"/
    )
    assert.match(
        open.last(),
        /"description":"Používá ho tvoje přihláška do klanu"/
    )
    const pick = component<StringSelectMenuInteraction>({
        customId: "link:l:unlink-pick",
        values: ["xbox:Hrac17CZ"],
    })
    await handleLinkComponent(pick.interaction, ports({ accounts }, calls))
    assert.deepEqual(calls.unlink, ["xbox:Hrac17CZ"])
    assert.match(pick.last(), /Tvoje propojené účty/)
    assert.doesNotMatch(pick.last(), /Hrac17CZ/)
})

test("inside the application the guide continues it after linking (L4-60)", async () => {
    const calls: Calls = { link: [], unlink: [], continued: [] }
    const select = component<StringSelectMenuInteraction>({
        customId: "link:a.k57abc:platform",
        values: ["steam"],
    })
    await handleLinkComponent(select.interaction, ports())
    assert.match(select.last(), /Zadat ID a pokračovat/)
    const f = modal("link-modal:a.k57abc:steam", { id: STEAM })
    await handleLinkIdModal(
        f.interaction,
        ports({ continueApplication: true }, calls)
    )
    assert.deepEqual(calls.continued, ["k57abc"])
})

test("stale and DM-era buttons say 'Tahle nabídka už neplatí' (L4-58, M3-12, L4-B10)", async () => {
    const registry = createInteractionRegistry(
        [linkInteractions(() => ports())],
        { enqueueEventSync: () => {}, triggerPollSoon: () => {} }
    )
    for (const customId of ["link:x:start", "plink:start:l:_:_"]) {
        const f = component<ButtonInteraction>({ customId })
        assert.equal(await registry.routeButton(f.interaction), true)
        assert.match(f.text(), /Tahle nabídka už neplatí/)
        assert.match(f.text(), /Spusť \/link znovu\./)
    }
    const legacySelect = component<StringSelectMenuInteraction>({
        customId: "plink:platform:l:_:_",
        values: ["steam"],
    })
    assert.equal(
        await registry.routeStringSelect(legacySelect.interaction),
        true
    )
    assert.match(legacySelect.text(), /Tahle nabídka už neplatí/)
    // The application's own account step keeps its routes.
    const membership = component<ButtonInteraction>({
        customId: "plink:start:m:main:h",
    })
    assert.equal(await registry.routeButton(membership.interaction), false)
})
