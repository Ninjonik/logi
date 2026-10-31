import {
    AppRouterContext,
    type AppRouterInstance,
} from "next/dist/shared/lib/app-router-context.shared-runtime"
import type { PublicCompetition } from "@/domain/competitions/competition"
import type { LeaguePortalView } from "@/domain/leagues/portal"
import { ClanCompetitions } from "../app/clan-competitions"
import { renderToStaticMarkup } from "react-dom/server"
import { createElement, type ReactNode } from "react"
import { getDictionary } from "@/i18n/dictionaries"
import { LeagueAccount } from "./league-account"
import assert from "node:assert/strict"
import test from "node:test"

const router: AppRouterInstance = {
    back() {},
    forward() {},
    refresh() {},
    push() {},
    replace() {},
    prefetch() {},
    bfcacheId: "test",
}
const render = (child: ReactNode) =>
    renderToStaticMarkup(
        createElement(AppRouterContext.Provider, { value: router }, child)
    )
const competition: PublicCompetition = {
    id: "cup",
    gameId: "wardogs",
    slug: "cup",
    name: "Cup",
    season: "2026",
    description: null,
    divisions: [],
    registrationMode: "automatic",
    minimumLinkedPlayers: null,
}
function account(): LeaguePortalView {
    return {
        teams: [
            {
                id: "team",
                name: "Our team",
                shortCode: "OUR",
                gameId: "wardogs",
                owner: true,
                accountOwner: true,
                members: 1,
                inviteToken: null,
                clanLinked: false,
                linkedGuildId: null,
                logoAssetId: null,
                logoUrl: null,
                description: null,
                revision: 1,
            },
        ],
        workspaces: [],
        registrations: ["first", "second"].map((slug) => ({
            teamId: "team",
            competitionId: slug,
            competitionName: `${slug} competition`,
            competitionSlug: slug,
            season: "2026",
            status: "approved",
            withdrawn: false,
        })),
        servers: [],
        fixtures: [],
        organiser: false,
    }
}
test("league creation uses the competition game while standalone creation retains the game picker", () => {
    const contextual = render(
        createElement(LeagueAccount, {
            view: account(),
            locale: "en",
            competition,
        })
    )
    assert.match(contextual, /Create team and register/)
    assert.doesNotMatch(contextual, /name="game"/)
    const standalone = render(
        createElement(LeagueAccount, {
            view: account(),
            locale: "en",
            competition: null,
        })
    )
    assert.match(standalone, /name="game"/)
})
test("team profiles expose branding, multiple competition entries and a discoverable Discord connection", () => {
    const markup = render(
        createElement(LeagueAccount, {
            view: account(),
            locale: "en",
            competition: null,
        })
    )
    assert.match(markup, /Edit profile/)
    assert.match(markup, /href="\/en\/leagues\/first\/join"/)
    assert.match(markup, /href="\/en\/leagues\/second\/join"/)
    assert.match(markup, /Discord connection/)
    assert.doesNotMatch(markup, /Request a new team|Suggest a change/)
})
test("clan competitions lead with actual entries rather than the whole directory", () => {
    const markup = render(
        createElement(ClanCompetitions, {
            serverId: "clan",
            locale: "en",
            dictionary: getDictionary("en"),
            view: {
                linkedPlayers: 1,
                teams: [{ id: "team", name: "Our team", gameId: "wardogs" }],
                competitions: [
                    {
                        ...competition,
                        name: "Entered Cup",
                        registrationMode: "automatic",
                        minimumLinkedPlayers: null,
                        registrations: [
                            {
                                teamId: "team",
                                status: "approved",
                                withdrawn: false,
                            },
                        ],
                    },
                    {
                        ...competition,
                        id: "other",
                        name: "Other available cup",
                        registrationMode: "automatic",
                        minimumLinkedPlayers: null,
                        registrations: [],
                    },
                ],
            },
        })
    )
    assert.match(markup, /Entered Cup/)
    assert.doesNotMatch(markup, /Other available cup/)
    assert.match(markup, /Your competitions \(1\)/)
    assert.match(markup, /Join a competition/)
    assert.match(markup, /Withdraw/)
})
