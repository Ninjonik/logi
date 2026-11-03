import assert from "node:assert/strict"
import test from "node:test"

import { getLeagueMessages as getDashboardLeagueMessages } from "./messages/leagues"
import { panelImageCopy } from "../domain/discord-publications/panel-image-copy"
import { getAnnouncementMessages } from "../lib/clan-language/announcements"
import { getGameAccountMessages } from "../lib/clan-language/game-accounts"
import { getApplicationMessages } from "../lib/clan-language/application"
import { getDirectMessages } from "../lib/clan-language/direct-messages"
import { getTeamManagementMessages } from "./messages/team-management"
import { getCommandMessages } from "../lib/clan-language/commands"
import { onboardingSamples } from "./messages/onboarding-samples"
import { getTicketMessages } from "../lib/clan-language/tickets"
import { getRosterMessages } from "../lib/clan-language/rosters"
import { getSystemMessages } from "../lib/clan-language/system"
import { getLeagueMessages } from "../lib/clan-language/league"
import { getPanelMessages } from "../lib/clan-language/panels"
import { getEventMessages } from "../lib/clan-language/events"
import { statsCopy } from "../domain/player-stats/stats-copy"
import { getSeedMessages } from "../lib/clan-language/seed"
import { getWalkthroughCopy } from "./messages/walkthrough"
import { getOnboardingCopy } from "./messages/onboarding"
import { toIntlLocale } from "../lib/intl-locale"
import { getDictionary } from "./dictionaries"

function compare(source: unknown, translated: unknown, path = "copy") {
    assert.equal(typeof translated, typeof source, path)
    if (typeof source === "string") {
        assert.equal(typeof translated, "string")
        assert.ok(
            String(translated).trim().length > 0 || source.trim().length === 0,
            path
        )
        const tokens = (value: string) =>
            (value.match(/\{\w+\}/gu) ?? []).sort()
        assert.deepEqual(tokens(String(translated)), tokens(source), path)
        assert.doesNotMatch(String(translated), /QZX\d|ZXQ\d|QQ\d{4}QQ/, path)
    } else if (source && typeof source === "object") {
        assert.ok(translated && typeof translated === "object", path)
        const entries = new Map(Object.entries(translated))
        for (const [key, value] of Object.entries(source)) {
            assert.ok(entries.has(key), `${path}.${key}`)
            compare(value, entries.get(key), `${path}.${key}`)
        }
    }
}

test("Polish covers every dashboard and bot key and preserves template substitutions", () => {
    for (const getter of [
        getDictionary,
        getOnboardingCopy,
        onboardingSamples,
        getWalkthroughCopy,
        getTeamManagementMessages,
        getDashboardLeagueMessages,
    ]) {
        compare(getter("en"), getter("pl"))
    }
    for (const getter of [
        getAnnouncementMessages,
        getApplicationMessages,
        getCommandMessages,
        getDirectMessages,
        getEventMessages,
        getGameAccountMessages,
        getLeagueMessages,
        getPanelMessages,
        getRosterMessages,
        getSeedMessages,
        getSystemMessages,
        getTicketMessages,
        panelImageCopy,
        statsCopy,
    ]) {
        compare(getter("en"), getter("pl"))
    }
    assert.equal(toIntlLocale("pl"), "pl-PL")
})

test("Polish uses gaming vocabulary and leaves game names intact", () => {
    const copy = getDictionary("pl")
    assert.equal(copy.home.landing.hero.primary, "Zacznij z kontem Discord")
    assert.equal(getRosterMessages("pl").common.openRoster, "Otwórz skład")
    assert.equal(getEventMessages("pl").embed.cap, "Cap")
    assert.equal(getSeedMessages("pl").labels.seed, "Seeding")
    assert.equal(panelImageCopy("pl").wardogs.valkyra, "Valkyra")
})
