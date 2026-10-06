import assert from "node:assert/strict"
import test from "node:test"

import {
    BOT_ERROR_SOURCES,
    BOT_ERROR_SOURCE_SPECS,
    BOT_PERMISSIONS,
    botErrorContextLine,
    botErrorExplanation,
    botErrorReportView,
    botErrorRetry,
    botErrorSummary,
    classifyDiscordFailure,
    permissionNames,
} from "./bot-errors"
import { getSystemMessages } from "../../lib/clan-language/system"
import { validateMessageView } from "./message-validation"
import { layoutMessageView } from "./message-layout"

const cs = getSystemMessages("cs")
const copy = cs.errorsChannel
const locale = cs.locale
const zone = "Europe/Prague"
const START = "2026-10-11T18:00:00.000Z"
const unix = Date.parse(START) / 1000
const layoutOptions = { copy: cs.kit, locale }

const textOf = (view: ReturnType<typeof botErrorReportView>) =>
    layoutMessageView(view, layoutOptions)
        .nodes.map((node) => ("content" in node ? node.content : ""))
        .join("\n")

test("Discord answers are classified by their code (L5-B02)", () => {
    assert.equal(classifyDiscordFailure({ code: 50013 }), "missingPermission")
    assert.equal(classifyDiscordFailure({ code: 50001 }), "missingAccess")
    assert.equal(classifyDiscordFailure({ code: 10003 }), "unknownChannel")
    assert.equal(classifyDiscordFailure({ code: 10011 }), "unknownRole")
    assert.equal(classifyDiscordFailure({ code: 30013 }), "fullServer")
    assert.equal(
        classifyDiscordFailure({
            code: 50035,
            message:
                "Invalid Form Body\nparent_id[CHANNEL_PARENT_MAX_CHANNELS]: Maximum number of channels in category reached (50)",
        }),
        "fullCategory"
    )
    assert.equal(classifyDiscordFailure({ code: "ETIMEDOUT" }), "timeout")
    assert.equal(classifyDiscordFailure({ name: "AbortError" }), "timeout")
    assert.equal(classifyDiscordFailure({ status: 503 }), "timeout")
    assert.equal(
        classifyDiscordFailure({ message: "Request timed out" }),
        "timeout"
    )
    assert.equal(classifyDiscordFailure({ code: 50035 }), "other")
    assert.equal(classifyDiscordFailure({}), "other")
})

test("the retry chip follows the flow and the class (L5-B03)", () => {
    assert.equal(botErrorRetry("announcement", "missingPermission"), "afterFix")
    assert.equal(botErrorRetry("calendarPanel", "timeout"), "byItself")
    assert.equal(botErrorRetry("calendarPanel", "other"), "byItself")
    assert.equal(botErrorRetry("ticketOpen", "missingPermission"), "playerTold")
    assert.equal(botErrorRetry("playerReport", "timeout"), "playerTold")
    // Later steps of something that already worked: nobody was told, and
    // the bot does not try again.
    for (const source of [
        "ticketSupport",
        "ticketIntro",
        "ticketRename",
        "applicationRecruiters",
        "applicationIntro",
        "applicationRename",
    ] as const) {
        assert.equal(botErrorRetry(source, "missingPermission"), "notRetried")
        assert.equal(botErrorRetry(source, "timeout"), "notRetried")
    }
    // Notices an admin fixes, and wrong channels, retry after the fix.
    assert.equal(botErrorRetry("panelPassword", "channelPublic"), "afterFix")
    assert.equal(botErrorRetry("seedControl", "channelPublic"), "afterFix")
    assert.equal(botErrorRetry("calendarPanel", "wrongChannelType"), "afterFix")
    assert.equal(BOT_ERROR_SOURCE_SPECS.panelPassword.failure, "channelPublic")
    assert.equal(BOT_ERROR_SOURCE_SPECS.seedControl.failure, "channelPublic")
})

test("notices and later steps read their own sentences in every language", () => {
    for (const language of ["cs", "en", "de"]) {
        const errors = getSystemMessages(language).errorsChannel
        for (const source of ["panelPassword", "seedControl"] as const) {
            const { reason, fix } = botErrorExplanation(
                errors,
                locale,
                source,
                { failure: "channelPublic", channel: "<#1>" }
            )
            assert.match(reason, /<#1>.*@everyone|@everyone.*<#1>/)
            assert.match(fix, /<#1>/)
            assert.doesNotMatch(`${reason} ${fix}`, /\{\w+\}/)
        }
        const intro = botErrorExplanation(errors, locale, "ticketIntro", {
            failure: "other",
        })
        assert.equal(
            intro.fix,
            `${errors.followUps.ticketIntro} ${errors.fixes.otherBackground}`
        )
        assert.ok(errors.retry.notRetried)
        assert.ok(errors.context.author.includes("{user}"))
        assert.ok(errors.context.panel.includes("{panel}"))
        assert.ok(errors.links.panels && errors.links.seed)
    }
    assert.equal(
        botErrorContextLine(copy, locale, zone, "panelPassword", {
            panel: "Vlci_#2",
            channel: "<#7>",
        }),
        "Panel Vlci\\_#2 · Kanál <#7>"
    )
    assert.equal(
        botErrorContextLine(copy, locale, zone, "ticketRename", {
            category: "Jiné",
            number: 12,
            user: "<@17>",
        }),
        "Kategorie Jiné · ticket #12 · autor <@17>"
    )
})

test("the missing permission example matches the board (L5-08..11)", () => {
    const view = botErrorReportView({
        copy,
        locale,
        timeZone: zone,
        source: "announcement",
        facts: {
            failure: "missingPermission",
            channel: "<#100000000000000001>",
            missingPermissions: ["EmbedLinks"],
        },
        context: {
            event: {
                title: "VLK vs ROG",
                category: "Přátelák",
                gameStart: START,
            },
        },
        links: {
            match: "https://logi.example/cs/dashboard/servers/s1/matches/e1",
            channels:
                "https://logi.example/cs/dashboard/servers/s1/settings/channels",
            managed: "https://logi.example/cs/dashboard/servers/s1",
        },
    })
    assert.equal(view.accent, "system")
    assert.equal(view.ephemeral, undefined)
    assert.equal(view.header?.label, "Chyba bota · Zápas")
    assert.equal(view.header?.title, "Ohlášení zápasu se neodeslalo")
    assert.equal(
        view.header?.subtitle,
        `-# VLK vs ROG · Přátelák · ne <t:${unix}:d> · <t:${unix}:t>`
    )
    assert.deepEqual(view.header?.chips, [
        { label: "Zkusí se znovu po opravě", tone: "warning" },
    ])
    const text = textOf(view)
    assert.match(text, /-# \*\*CHYBA BOTA · ZÁPAS\*\*/)
    assert.match(
        text,
        /\*\*Proč\*\*\nBot nemá v kanálu <#100000000000000001> oprávnění Vkládat odkazy\.\n\*\*Co udělat\*\*\nV Discordu otevři <#100000000000000001> → Upravit kanál → Oprávnění → Logi a povol Vkládat odkazy\. Ohlášení se pošle samo při další synchronizaci, do 5 minut\./
    )
    const buttons = view.blocks.flatMap((block) =>
        block.kind === "buttons" ? block.buttons : []
    )
    assert.deepEqual(
        buttons.map((button) => button.label),
        ["Otevřít zápas", "Kanály v Logi"]
    )
    assert.ok(buttons.every((button) => button.kind === "link"))
    assert.equal(validateMessageView(view, layoutOptions).ok, true)
    assert.match(text, /Spravováno v Logi/)
})

test("the ticket example names private threads and tells the player (L5-12)", () => {
    const view = botErrorReportView({
        copy,
        locale,
        timeZone: zone,
        source: "ticketOpen",
        facts: {
            failure: "missingPermission",
            channel: "<#100000000000000002>",
            missingPermissions: [
                "CreatePrivateThreads",
                "SendMessagesInThreads",
            ],
        },
        context: {
            category: "Nahlásit hráče",
            user: "<@100000000000000017>",
        },
        links: { tickets: "https://logi.example/t" },
    })
    assert.equal(view.header?.label, "Chyba bota · Tickety")
    assert.equal(view.header?.title, "Ticket se neotevřel")
    assert.equal(
        view.header?.subtitle,
        "-# Kategorie Nahlásit hráče · zkoušel <@100000000000000017>"
    )
    assert.equal(
        view.header?.chips?.[0]?.label,
        "Hráč dostal zprávu, ať to zkusí později"
    )
    const text = textOf(view)
    assert.match(
        text,
        /Bot nemůže v kanálu <#100000000000000002> zakládat soukromá vlákna\./
    )
    assert.match(
        text,
        /Povol roli Logi v <#100000000000000002> oprávnění Vytvářet soukromá vlákna a Posílat zprávy ve vláknech\. Pak hráči napiš, ať ticket otevře znovu\./
    )
})

test("the forum, member role and timeout examples match the board (L5-13..15)", () => {
    const forum = botErrorExplanation(copy, locale, "forumCreate", {
        failure: "fullCategory",
        category: "Akce",
    })
    assert.deepEqual(forum, {
        reason: "Kategorie Akce už má 50 kanálů, víc Discord do jedné kategorie nedovolí.",
        fix: "Smaž kanály starých akcí, nebo vyber jinou kategorii pro fóra v Logi → Kanály a jazyk.",
    })
    const roles = botErrorReportView({
        copy,
        locale,
        timeZone: zone,
        source: "memberRoles",
        facts: { failure: "roleAbove", role: "<@&300>" },
        context: {
            role: "<@&300>",
            members: ["Hráč 17", "Hráč 21", "Hráč 23"],
        },
        links: { roles: "https://logi.example/roles" },
    })
    assert.equal(roles.header?.title, "Role se 3 členům nepodařilo upravit")
    assert.equal(
        roles.header?.subtitle,
        "-# Role <@&300> · Hráč 17, Hráč 21, Hráč 23"
    )
    assert.match(
        textOf(roles),
        /Role <@&300> je v seznamu rolí výš než role Logi, takže ji bot nemůže přidávat ani brát\.\n\*\*Co udělat\*\*\nV Discordu → Nastavení serveru → Role přetáhni roli Logi nad <@&300>\. Role se doplní při další synchronizaci\./
    )
    const calendar = botErrorReportView({
        copy,
        locale,
        timeZone: zone,
        source: "calendarPanel",
        facts: { failure: "timeout" },
        context: { channel: "<#400>" },
        links: { channels: "https://logi.example/channels" },
    })
    assert.equal(calendar.header?.title, "Kalendář se neaktualizoval")
    assert.equal(calendar.header?.subtitle, "-# Kanál <#400>")
    assert.equal(calendar.header?.chips?.[0]?.label, "Zkusí se znovu sám")
    assert.match(
        textOf(calendar),
        /Discord neodpověděl včas\.\n\*\*Co udělat\*\*\nNic\. Bot to zkusí znovu při další synchronizaci\. Když se zpráva opakuje déle než hodinu, napiš podpoře Logi\./
    )
    assert.ok(!calendar.blocks.some((block) => block.kind === "buttons"))
})

test("every Discord answer has its sentence pair (L5-26..32)", () => {
    const pair = (
        failure: Parameters<typeof botErrorExplanation>[3]["failure"]
    ) =>
        botErrorExplanation(copy, locale, "general", {
            failure,
            channel: "#kanal",
            role: "@role",
            category: "Akce",
        })
    assert.deepEqual(pair("missingAccess"), {
        reason: "Bot do kanálu #kanal nevidí.",
        fix: "Přidej roli Logi do kanálu, nebo vyber jiný kanál v Logi.",
    })
    assert.deepEqual(pair("unknownChannel"), {
        reason: "Kanál #kanal už na serveru není.",
        fix: "Vyber nový kanál v Logi → Kanály a jazyk.",
    })
    assert.equal(pair("unknownRole").reason, "Role @role už neexistuje.")
    assert.deepEqual(pair("fullCategory"), {
        reason: "Kategorie Akce už má 50 kanálů, víc Discord do jedné kategorie nedovolí.",
        fix: "Smaž staré kanály, nebo vyber jinou kategorii.",
    })
    assert.equal(
        pair("fullServer").reason,
        "Na serveru je 500 kanálů, víc Discord nedovolí."
    )
    assert.deepEqual(pair("other"), {
        reason: "Discord akci odmítl.",
        fix: "Zkus to znovu. Když se to opakuje, napiš podpoře Logi a pošli čas chyby.",
    })
    assert.deepEqual(
        botErrorExplanation(copy, locale, "general", {
            failure: "missingPermission",
            missingPermissions: ["EmbedLinks"],
        }),
        {
            reason: "Bot nemá v kanálu z nastavení Logi oprávnění Vkládat odkazy.",
            fix: "Povol roli Logi oprávnění Vkládat odkazy v nastavení kanálu.",
        }
    )
    assert.deepEqual(
        botErrorExplanation(copy, locale, "eventRoles", {
            failure: "missingPermission",
            missingPermissions: ["ManageRoles"],
            serverWide: true,
        }),
        {
            reason: "Role Logi nemá na serveru oprávnění Spravovat role.",
            fix: "V Discordu → Nastavení serveru → Role → Logi povol Spravovat role. Role se nastaví při další synchronizaci.",
        }
    )
})

test("member lists stop at five names (L5-B05)", () => {
    const line = botErrorContextLine(copy, locale, zone, "memberRoles", {
        role: "<@&1>",
        members: ["A", "B", "C", "D", "E", "F", "G"],
    })
    assert.equal(line, "Role <@&1> · A, B, C, D, E a další 2")
})

test("cards carry no raw error text, codes or internal step names (L5-16, L5-B04)", () => {
    for (const source of BOT_ERROR_SOURCES)
        for (const failure of [
            "missingPermission",
            "missingAccess",
            "unknownChannel",
            "unknownRole",
            "roleAbove",
            "fullCategory",
            "fullServer",
            "wrongChannelType",
            "channelPublic",
            "timeout",
            "other",
        ] as const) {
            const view = botErrorReportView({
                copy,
                locale,
                timeZone: zone,
                source,
                facts: { failure, missingPermissions: ["SendMessages"] },
            })
            const text = textOf(view)
            assert.doesNotMatch(
                text,
                /50013|guild-sync|Missing Permissions|undefined|\{\w+\}/,
                `${source} ${failure}`
            )
            assert.equal(validateMessageView(view, layoutOptions).ok, true)
        }
})

test("every source and permission has copy in every language", () => {
    for (const language of ["en", "cs", "de"]) {
        const errors = getSystemMessages(language).errorsChannel
        for (const source of BOT_ERROR_SOURCES) {
            if (source !== "memberRoles") assert.ok(errors.titles[source])
            const area = BOT_ERROR_SOURCE_SPECS[source].area
            if (area) assert.ok(errors.areas[area], `${language} ${area}`)
        }
        for (const permission of BOT_PERMISSIONS)
            assert.ok(errors.permissions[permission])
    }
    assert.equal(
        permissionNames(copy, ["EmbedLinks", "AttachFiles", "EmbedLinks"]),
        "Vkládat odkazy a Přikládat soubory"
    )
})

test("the one-line summary for the dashboard uses the same words (L5-44)", () => {
    const summary = botErrorSummary(copy, locale, "publicPanel", {
        failure: "missingPermission",
        channel: "#servery",
        missingPermissions: ["AttachFiles"],
    })
    assert.equal(
        summary,
        "Panel se neaktualizoval. Proč: Bot nemá v kanálu #servery oprávnění Přikládat soubory. Co udělat: V Discordu otevři #servery → Upravit kanál → Oprávnění → Logi a povol Přikládat soubory."
    )
    const long = botErrorSummary(
        copy,
        locale,
        "publicPanel",
        {
            failure: "missingPermission",
            channel: "#servery",
            missingPermissions: [...BOT_PERMISSIONS],
        },
        120
    )
    assert.equal(long.length, 120)
    assert.ok(long.endsWith("…"))
})
