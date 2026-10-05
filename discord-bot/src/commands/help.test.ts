import assert from "node:assert/strict"
import test from "node:test"

import { MessageFlags } from "discord.js"

import {
    createInteractionRegistry,
    type InteractionFeatureContext,
} from "../interactions/registry"
import {
    callerOf,
    configsOf,
    fakeInteraction,
    testGuildConfig,
} from "./fake-interaction"
import { handleHelpCommand, helpInteractions, type HelpDeps } from "./help"

const deps = (overrides: Partial<HelpDeps> = {}): HelpDeps => ({
    configs: configsOf(
        testGuildConfig({
            ticketSettings: {
                enabled: true,
                submitChannelId: "300000000000000004",
                categories: [{ supportRoleIds: ["100000000000000003"] }],
            },
            membershipSettings: {
                enabled: true,
                submitChannelId: "300000000000000005",
                categories: [{ supportRoleIds: ["100000000000000004"] }],
            },
        })
    ),
    workspaceOf: async () => ({ workspaceId: "guilds:a" }),
    readCaller: callerOf({ isAdministrator: false, roleIds: [] }),
    siteUrl: "https://logi.example/",
    ...overrides,
})
const run = async (overrides: Partial<HelpDeps> = {}) => {
    const f = fakeInteraction<Parameters<typeof handleHelpCommand>[0]>({
        guild: { name: "Vlci", preferredLocale: "cs", fetch: async () => ({}) },
    })
    await handleHelpCommand(f.interaction, deps(overrides))
    return f
}

test("/help is a private reply in the clan language, never posted to the channel (M1-26, M2-B01)", async () => {
    const f = await run()
    assert.equal(f.sent.length, 1)
    assert.equal(f.sent[0]!.kind, "edit", "deferred privately first")
    const out = f.text()
    assert.match(out, /PŘÍKAZY LOGI · KLAN VLCI/)
    assert.match(out, /Co tady můžeš použít/)
    assert.match(
        out,
        /<#300000000000000005>, <#300000000000000004> a <#300000000000000003>/
    )
    assert.match(out, /https:\/\/logi\.example\/wiki\/configuration\/commands/)
    assert.doesNotMatch(out, /PRO SPRÁVCE/)
})

test("an admin sees the staff part; category support only its closing command (M2-09, M2-11)", async () => {
    const admin = await run({
        readCaller: callerOf({
            isAdministrator: false,
            roleIds: ["100000000000000001"],
        }),
    })
    assert.match(admin.text(), /PRO SPRÁVCE/)
    assert.match(admin.text(), /server-status/)
    const support = await run({
        readCaller: callerOf({
            isAdministrator: false,
            roleIds: ["100000000000000003"],
        }),
    })
    assert.match(support.text(), /close_ticket/)
    assert.doesNotMatch(support.text(), /close_application|server-status/)
})

test("a server without Logi gets the setup card (M2-10)", async () => {
    const f = await run({
        configs: configsOf(null),
        workspaceOf: async () => null,
    })
    assert.match(f.text(), /Logi tu ještě není nastavené/)
    assert.match(f.text(), /Co je Logi/)
})

test("a switched-off /help says so; Discord not answering is the role card", async () => {
    const off = await run({
        configs: configsOf(
            testGuildConfig({ commandSettings: { help: { enabled: false } } })
        ),
    })
    assert.match(off.text(), /Příkaz \/help je tu vypnutý/)
    const silent = await run({ readCaller: callerOf(null) })
    assert.match(silent.text(), /Teď nejde ověřit tvoje role/)
})

test("/help is routed through the interaction registry", async () => {
    const context: InteractionFeatureContext = {
        enqueueEventSync: () => {},
        triggerPollSoon: () => {},
    }
    const registry = createInteractionRegistry(
        [helpInteractions(() => deps())],
        context
    )
    assert.deepEqual(registry.routes(), ["command:help"])
    const f = fakeInteraction<never>({
        commandName: "help",
        guild: { name: "Vlci", fetch: async () => ({}) },
    })
    assert.equal(await registry.routeCommand(f.interaction), true)
    const reply = f.sent[0]!.value as { flags?: number }
    assert.equal(reply.flags, MessageFlags.IsComponentsV2)
})
