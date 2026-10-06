import assert from "node:assert/strict"
import test from "node:test"

import {
    isTeamRequestDecision,
    teamRequestDecisionView,
    type TeamRequestDmInput,
} from "./team-request-dm"
import { getSystemMessages } from "../../lib/clan-language/system"
import { validateMessageView } from "./message-validation"
import { layoutMessageView } from "./message-layout"

const cs = getSystemMessages("cs")
const layout = { copy: cs.kit, locale: cs.locale }
const base: TeamRequestDmInput = {
    copy: cs.teamRequests,
    gameLabel: "Hell Let Loose",
    status: "approved",
    kind: "create",
    requestedName: "Vlci",
    team: { name: "Vlci", code: "VLK" },
    reason: null,
    teamUrl:
        "https://logi.example/cs/dashboard/servers/s1/teams?game=hell_let_loose",
    teamsUrl: "https://logi.example/cs/dashboard/servers/s1/teams?game=wardogs",
    frame: {
        clanName: "Vlci",
        settingsUrl:
            "https://logi.example/cs/dashboard/settings/user#zpravy-od-bota",
    },
}
const text = (input: Partial<TeamRequestDmInput>) => {
    const view = teamRequestDecisionView({ ...base, ...input })
    assert.equal(validateMessageView(view, layout).ok, true)
    return {
        view,
        text: layoutMessageView(view, layout)
            .nodes.map((node) => ("content" in node ? node.content : ""))
            .join("\n"),
        buttons: view.blocks.flatMap((block) =>
            block.kind === "buttons" ? block.buttons : []
        ),
    }
}

test("approved: 'Tým je v katalogu' with the code and a link (L5-39, L2-57)", () => {
    const { view, text: rendered, buttons } = text({})
    assert.equal(view.accent, "clan")
    assert.equal(view.header?.label, "Katalog týmů Logi · Hell Let Loose")
    assert.equal(view.header?.title, "Tým je v katalogu")
    assert.deepEqual(view.header?.chips, [
        { label: "Schváleno", tone: "success" },
    ])
    assert.match(rendered, /-# \*\*KATALOG TÝMŮ LOGI · HELL LET LOOSE\*\*/)
    assert.match(rendered, /`VLK` \*\*Vlci\*\* · nový tým/)
    assert.match(rendered, /Tým teď můžeš vybrat u zápasů\./)
    assert.deepEqual(
        buttons.map((button) => [button.kind, button.label]),
        [["link", "Otevřít tým v Logi"]]
    )
    assert.match(
        rendered,
        /-# Klan Vlci · \[Nastavit zprávy\]\(https:\/\/logi\.example\/cs\/dashboard\/settings\/user#zpravy-od-bota\)$/
    )
})

test("merged: names the requested name and the existing team (L5-40)", () => {
    const { view, text: rendered } = text({
        status: "merged",
        requestedName: "Rogue Co.",
        team: { name: "Rogue Company", code: "ROG" },
    })
    assert.equal(view.header?.title, "Tým už v katalogu byl")
    assert.deepEqual(view.header?.chips?.[0], {
        label: "Sloučeno",
        tone: "info",
    })
    assert.match(
        rendered,
        /`ROG` \*\*Rogue Company\*\* · žádal\(a\) jsi „Rogue Co\.“/
    )
    assert.match(
        rendered,
        /Tvoje žádost se připojila k existujícímu týmu\. U zápasů vyber tento tým\./
    )
})

test("rejected: the reason as a quote and the way back (L5-41, L2-58)", () => {
    const {
        view,
        text: rendered,
        buttons,
    } = text({
        status: "rejected",
        kind: "update",
        gameLabel: "Wardogs",
        requestedName: "Black Dogs",
        team: { name: "Black Dogs", code: "BD" },
        reason: "Logo porušuje pravidla katalogu. Pošli prosím jiné.",
    })
    assert.equal(view.header?.label, "Katalog týmů Logi · Wardogs")
    assert.equal(view.header?.title, "Žádost o tým nebyla přijata")
    assert.deepEqual(view.header?.chips?.[0], {
        label: "Zamítnuto",
        tone: "danger",
    })
    assert.match(rendered, /Žádost o změnu · tým Black Dogs/)
    assert.match(
        rendered,
        /> Logo porušuje pravidla katalogu\. Pošli prosím jiné\./
    )
    assert.match(rendered, /Opravenou žádost pošleš v Logi → Týmy\./)
    assert.deepEqual(
        buttons.map((button) => button.label),
        ["Otevřít Týmy v Logi"]
    )
})

test("user text cannot format, mention or break the card", () => {
    const { text: rendered } = text({
        status: "rejected",
        requestedName: "**Bad** <@123>",
        team: null,
        reason: "line one\n# heading <@&5> @everyone",
    })
    assert.doesNotMatch(rendered, /<@123>|<@&5>|\n# heading/)
    assert.match(rendered, /tým \\\*\\\*Bad\\\*\\\* \\<@123\\>/)
    assert.equal(isTeamRequestDecision("pending"), false)
    assert.equal(isTeamRequestDecision("merged"), true)
})

test("every language has the same team request keys", () => {
    const keys = Object.keys(cs.teamRequests).sort()
    for (const language of ["en", "de"])
        assert.deepEqual(
            Object.keys(getSystemMessages(language).teamRequests).sort(),
            keys
        )
})
