import {
    leaguePanelOptionsSchema,
    DEFAULT_LEAGUE_PANEL_OPTIONS,
} from "../src/domain/wardogs-league/panels"
import { convexLeaguePanelSource } from "../src/infrastructure/convex/league-fixture-store"
import { loadLeaguePanels } from "../src/application/wardogs-league/league-panels"
import { assertSessionGateway } from "./dashboardSessionStore"
import { trackingConfig } from "./leagueTrackingStore"
import { query } from "./_generated/server"
import { v } from "convex/values"

/**
 * View-models of the two WD League panels for one guild (bot worker,
 * dashboard preview). The League data is shared; the guild's watched team
 * codes mark "our" team. Requires the internal secret.
 */
export const forGuild = query({
    args: {
        secret: v.string(),
        guildId: v.string(),
        options: v.optional(
            v.object({
                table: v.boolean(),
                fixtures: v.boolean(),
                recentResults: v.boolean(),
                fixtureCount: v.number(),
            })
        ),
    },
    handler: async (ctx, args) => {
        assertSessionGateway(args.secret)
        const options = leaguePanelOptionsSchema.parse(
            args.options ?? DEFAULT_LEAGUE_PANEL_OPTIONS
        )
        const config = await trackingConfig(ctx, args.guildId)
        const now = Date.now()
        return loadLeaguePanels(convexLeaguePanelSource(ctx, now), {
            now,
            ourTeamCodes: config?.teamCodes ?? [],
            options,
        })
    },
})
