import assert from "node:assert/strict"
import test from "node:test"

import { getDirectMessages } from "@/lib/clan-language/direct-messages"
import { getRosterMessages } from "@/lib/clan-language/rosters"
import { getSystemMessages } from "@/lib/clan-language/system"

import {
    attendanceConfirmedReply,
    attendanceModalCopy,
    attendanceReminderView,
    declineSavedReply,
    formatDecimal,
    lateNoticeSavedReply,
    matchRecapView,
    matchStartedReply,
    rosterChangeDmView,
    signupReminderView,
    trainingResultView,
    type DmEvent,
    type DmFrame,
} from "./direct-message-views"
import { layoutMessageView, type MessageLayoutOptions } from "./message-layout"
import { validateMessageView } from "./message-validation"
import type { MessageView } from "./message-view"

const layout: MessageLayoutOptions = {
    copy: getSystemMessages("cs").kit,
    locale: "cs-CZ",
}
const copy = getDirectMessages("cs")
const rosterCopy = getRosterMessages("cs")
const frame: DmFrame = {
    clanName: "Vlci",
    settingsUrl:
        "https://logi.example/cs/dashboard/settings/user#zpravy-od-bota",
    timeZone: "Europe/Prague",
}

const event: DmEvent = {
    id: "event-1",
    title: "VLK vs ROG",
    category: { label: "Přátelák", color: "#22c55e" },
    teams: [
        {
            slot: "a",
            side: "Allies",
            snapshot: { name: "Vlci", shortCode: "VLK" },
        },
        {
            slot: "b",
            side: "Axis",
            snapshot: { name: "Rogue", shortCode: "ROG" },
        },
    ],
    mapLabel: "Foy · den",
    registrationEnd: "2026-10-10T17:30:00.000Z",
    meetingStart: "2026-10-11T17:30:00.000Z",
    gameStart: "2026-10-11T18:00:00.000Z",
    meetingChannelId: "200000000000000001",
}

const text = (view: MessageView) =>
    layoutMessageView(view, layout)
        .nodes.flatMap((node) =>
            node.type === "text"
                ? [node.content]
                : node.type === "section"
                  ? node.texts
                  : []
        )
        .join("\n")

const buttons = (view: MessageView) =>
    layoutMessageView(view, layout).nodes.flatMap((node) =>
        node.type === "buttons" ? node.buttons : []
    )

const footer =
    "-# Klan Vlci · [Nastavit zprávy](https://logi.example/cs/dashboard/settings/user#zpravy-od-bota)"

test("sign-up reminder: label, match, weekday start, deadline chip, why it came and the DM footer", () => {
    const view = signupReminderView({
        event,
        ids: {
            signUp: "signup:event-1:PRIMARY_GROUP:g",
            decline: "signup:event-1:NOT_ATTENDING:g",
        },
        announcementUrl: "https://discord.com/channels/1/2/3",
        copy,
        rosterCopy,
        frame,
    })
    assert.deepEqual(validateMessageView(view, layout).issues, [])
    const content = text(view)
    assert.match(
        content,
        /-# \*\*PŘIPOMÍNKA PŘIHLÁŠKY\*\*\n### VLK vs ROG\n🟢 \*\*Přátelák\*\*/
    )
    assert.match(content, /\*\*VLK\*\* Spojenci ★  vs  \*\*ROG\*\* Osa ✚/)
    assert.match(
        content,
        /\*\*ne <t:1791741600:d> · <t:1791741600:t>\*\* · <t:1791741600:R>/
    )
    assert.match(content, /Foy · den · sraz <t:1791739800:t>/)
    assert.match(
        content,
        /🟡 \*\*Přihlášky končí\*\* · so <t:1791653400:d> v <t:1791653400:t> · <t:1791653400:R>/
    )
    assert.match(
        content,
        /Na zápas ještě nemáš přihlášku\. Dej velení vědět, jestli přijdeš\./
    )
    assert.ok(content.endsWith(footer))
    assert.doesNotMatch(content, /Připomínku poslalo velení/)
    assert.deepEqual(
        buttons(view).map((button) => [
            button.label,
            button.kind === "action" ? button.style : "link",
        ]),
        [
            ["Přihlásit se", "success"],
            ["Nepřijdu", "danger"],
            ["Otevřít ohlášení", "link"],
        ]
    )
    const manual = signupReminderView({
        event,
        ids: { signUp: "a", decline: "b" },
        sentByLeaders: true,
        copy,
        rosterCopy,
        frame,
    })
    assert.match(text(manual), /-# Připomínku poslalo velení z Logi\./)
})

test("attendance reminder: tomorrow title, weekday schedule, place with the squad leader and three buttons", () => {
    const view = attendanceReminderView({
        event,
        place: {
            kind: "squad",
            squad: "F1",
            role: "Medic",
            leader: "Rex\\_CZ",
        },
        now: Date.parse("2026-10-10T17:30:00.000Z"),
        copy,
        frame,
    })
    assert.deepEqual(validateMessageView(view, layout).issues, [])
    const content = text(view)
    assert.match(
        content,
        /\*\*PŘIPOMÍNKA DOCHÁZKY\*\*\n### Zítra hraješ VLK vs ROG/
    )
    assert.match(
        content,
        /ne <t:1791741600:d> · sraz <t:1791739800:t> · start <t:1791741600:t>\n/
    )
    assert.match(content, /\*\*F1 · Medic\*\* · velitel čety Rex\\_CZ/)
    assert.match(content, /Potvrď, ať velení ví, s kým počítat\./)
    assert.ok(content.endsWith(footer))
    assert.deepEqual(
        buttons(view).map((button) => [
            button.label,
            button.kind === "action" ? `${button.style} ${button.id}` : "link",
        ]),
        [
            ["Potvrdím", "primary attendance-confirm:event-1"],
            ["Přijdu později", "secondary attendance-late:event-1"],
            ["Nemůžu", "danger attendance-decline:event-1"],
        ]
    )
    // No password ever reaches a DM.
    assert.doesNotMatch(content, /heslo/)
})

test("manual attendance reminder for a reserve on match day", () => {
    const view = attendanceReminderView({
        event,
        place: { kind: "reserve" },
        now: Date.parse("2026-10-11T15:05:00.000Z"),
        sentByLeaders: true,
        copy,
        frame,
    })
    const content = text(view)
    assert.match(content, /### Dnes hraješ VLK vs ROG/)
    assert.match(content, /start <t:1791741600:t> · <t:1791739800:R>/)
    assert.match(
        content,
        /\*\*Záloha\*\* · když se uvolní místo, velení tě přesune/
    )
    assert.match(content, /-# Připomínku poslalo velení z Logi\./)
})

test("replies in the same DM carry the DM footer and are not private there", () => {
    const confirmed = attendanceConfirmedReply({
        event,
        copy,
        dateAt: rosterCopy.common.dateAt,
        timeZone: "Europe/Prague",
        dm: true,
        frame,
    })
    assert.equal(confirmed.ephemeral, undefined)
    assert.match(
        text(confirmed),
        /### Účast potvrzena\nUvidíme se v ne <t:1791739800:d> v <t:1791739800:t> v kanálu <#200000000000000001>\./
    )
    assert.ok(text(confirmed).endsWith(footer))
    const started = matchStartedReply({ copy, dm: true, frame })
    assert.match(
        text(started),
        /### Zápas už začal\nPotvrdit ani omluvit se teď nedá\. Napiš velení přímo\./
    )
    const late = lateNoticeSavedReply({
        text: "Ve 20:15, končím v práci.",
        copy,
        dm: true,
        frame,
    })
    assert.match(
        text(late),
        /### Velení ví, že přijdeš později\n> Ve 20:15, končím v práci\./
    )
    const declined = declineSavedReply({ squad: "F1", copy, dm: true, frame })
    assert.match(
        text(declined),
        /### Velení ví, že nedorazíš\nTvoje místo v F1 obsadí někdo ze záloh\. Díky, že dáváš vědět včas\./
    )
    // The board draws a divider above the DM footer (L2-28..34).
    for (const view of [confirmed, started, late, declined])
        assert.deepEqual(view.blocks.at(-1), {
            kind: "separator",
            divider: true,
            spacing: "small",
        })
    // In the server the same reply is private and has no DM footer.
    const inGuild = declineSavedReply({ squad: "F1", copy, dm: false })
    assert.equal(inGuild.ephemeral, true)
    assert.equal(inGuild.footer, undefined)
    assert.equal(
        inGuild.blocks.some((block) => block.kind === "separator"),
        false
    )
})

test("the late and cannot-come forms name the match", () => {
    assert.deepEqual(attendanceModalCopy("late", "VLK vs ROG", copy), {
        title: "Přijdu později · VLK vs ROG",
        label: "Kdy dorazíš a proč",
        placeholder: "Např. ve 20:15, končím v práci",
        required: true,
    })
    assert.deepEqual(attendanceModalCopy("decline", "VLK vs ROG", copy), {
        title: "Nemůžu přijít · VLK vs ROG",
        label: "Důvod, uvidí ho jen velení",
        placeholder: "Např. nemoc, práce",
        required: false,
    })
})

test("roster change DMs: added, removed, moved, new role and both together", () => {
    const base = {
        event,
        rosterUrl: "https://logi.example/cs/rosters/event-1",
        copy,
        rosterCopy,
        frame,
    }
    const added = rosterChangeDmView({
        ...base,
        leader: "Rex\\_CZ",
        change: {
            userId: "u",
            after: { squad: "F1", role: "Rifleman" },
            added: true,
            removed: false,
            toReserves: false,
            moved: false,
            roleChanged: false,
        },
    })
    assert.deepEqual(validateMessageView(added, layout).issues, [])
    assert.match(
        text(added),
        /\*\*SOUPISKA · VLK VS ROG\*\*\n### Jsi na soupisce\nne <t:1791741600:d> · sraz <t:1791739800:t> · start <t:1791741600:t> · <t:1791739800:R>\n\*\*F1 · Rifleman\*\* · velitel čety Rex\\_CZ/
    )
    assert.deepEqual(
        buttons(added).map((button) => button.label),
        ["Zobrazit zařazení"]
    )
    const removed = rosterChangeDmView({
        ...base,
        change: {
            userId: "u",
            before: { squad: "F1", role: "Anti-Tank" },
            added: false,
            removed: true,
            toReserves: false,
            moved: false,
            roleChanged: false,
        },
    })
    assert.match(text(removed), /### Už nejsi na soupisce/)
    assert.match(
        text(removed),
        /Velení tě odebralo z F1 \(Anti-Tank\)\. Když tě vrátí, přijde ti nová zpráva\./
    )
    assert.deepEqual(
        buttons(removed).map((button) => [button.label, button.kind]),
        [["Otevřít soupisku", "link"]]
    )
    const moved = rosterChangeDmView({
        ...base,
        leader: "Rex\\_CZ",
        change: {
            userId: "u",
            before: { squad: "F2", role: "Anti-Tank" },
            after: { squad: "F1", role: "Anti-Tank" },
            added: false,
            removed: false,
            toReserves: false,
            moved: true,
            roleChanged: false,
        },
    })
    assert.match(text(moved), /### Jiná četa: F1/)
    assert.match(
        text(moved),
        /\*\*F2 → F1\*\* · role zůstává Anti-Tank · velitel čety Rex\\_CZ/
    )
    const role = rosterChangeDmView({
        ...base,
        leader: "Jaguár",
        change: {
            userId: "u",
            before: { squad: "F2", role: "Rifleman" },
            after: { squad: "F2", role: "Anti-Tank" },
            added: false,
            removed: false,
            toReserves: false,
            moved: false,
            roleChanged: true,
        },
    })
    assert.match(text(role), /### Nová role: Anti-Tank/)
    assert.match(
        text(role),
        /\*\*Rifleman → Anti-Tank\*\* · zůstáváš v F2 · velitel čety Jaguár/
    )
    const both = rosterChangeDmView({
        ...base,
        change: {
            userId: "u",
            before: { squad: "F2" },
            after: { squad: "F1", role: "Medic" },
            added: false,
            removed: false,
            toReserves: false,
            moved: true,
            roleChanged: true,
        },
    })
    assert.match(text(both), /\*\*F2 → F1\*\* · \*\*bez role → Medic\*\*/)
    assert.doesNotMatch(text(both), /Unassigned/)
})

test("match recap: game label, result chip, numbers with the clan's decimal comma, source and toggle", () => {
    const base = {
        event: { ...event },
        gameId: "hell_let_loose" as const,
        place: { squad: "F1", role: "Medic" },
        result: {
            outcome: "win" as const,
            score: "4 : 1",
            team: "VLK",
            side: "Allies",
        },
        stats: {
            kills: 36,
            deaths: 15,
            kd: 2.4,
            previous: { matches: 10, kills: 29.4, deaths: 16.7, kd: 1.76 },
        },
        source: { server: "Vlci #1", provider: "CRCON" },
        statsUrl: "https://logi.example/cs/players/u/matches/event-1",
        settingsUrl: frame.settingsUrl,
        copy,
        rosterCopy,
        frame,
    }
    const on = matchRecapView({ ...base, enabled: true })
    assert.deepEqual(validateMessageView(on, layout).issues, [])
    const content = text(on)
    assert.match(
        content,
        /\*\*SHRNUTÍ ZÁPASU · HELL LET LOOSE\*\*\n### VLK vs ROG/
    )
    assert.match(content, /ne <t:1791741600:d> · Foy · den · F1 · Medic/)
    assert.match(content, /🟢 \*\*Výhra 4 : 1\*\* · VLK za Spojence/)
    assert.match(
        content,
        /Zabití \*\*36\*\* · Úmrtí \*\*15\*\* · K\/D \*\*2,40\*\*/
    )
    assert.match(
        content,
        /Průměr z 10 předchozích zápasů: 29,4 zabití · 16,7 úmrtí · K\/D 1,76/
    )
    assert.match(
        content,
        /Data ze serveru Vlci #1 \(CRCON\), jen tento zápas\./
    )
    assert.deepEqual(
        buttons(on).map((button) => button.label),
        ["Zobrazit statistiky", "Vypnout shrnutí"]
    )
    const off = matchRecapView({ ...base, enabled: false })
    assert.match(
        text(off),
        /⚪ \*\*Shrnutí vypnutá\*\* · platí pro všechny tvoje klany v Logi/
    )
    assert.deepEqual(
        buttons(off).map((button) => button.label),
        ["Zobrazit statistiky", "Zapnout shrnutí", "Otevřít nastavení"]
    )
    assert.equal(formatDecimal(2.4, "en-GB", 2), "2.40")
})

test("training result: passed with the new role, failed with the next date", () => {
    const passed = trainingResultView({
        title: "Trénink · komunikace a souhra",
        gameStart: "2026-10-12T17:00:00.000Z",
        passed: true,
        rewardRoles: ["Pěchota"],
        copy,
        frame,
    })
    assert.match(
        text(passed),
        /\*\*VÝSLEDEK TRÉNINKU\*\*\n### Trénink · komunikace a souhra\npo <t:1791824400:d> · <t:1791824400:t> · hodnotilo velení\n🟢 \*\*Splněno\*\* · máš novou roli \*\*@Pěchota\*\*/
    )
    const failed = trainingResultView({
        title: "Trénink",
        gameStart: "2026-10-12T17:00:00.000Z",
        passed: false,
        copy,
        frame,
    })
    assert.match(
        text(failed),
        /🔴 \*\*Nesplněno\*\*\nDalší termín najdeš v kalendáři klanu\./
    )
    // A divider above the DM footer, as on the board (L2-52).
    for (const view of [passed, failed])
        assert.equal(view.blocks.at(-1)?.kind, "separator")
})
