import {
    DEFAULT_LEAGUE_PANEL_OPTIONS,
    leaguePanelOptionsOf,
} from "../src/domain/wardogs-league/panel-data"
import { convexLeaguePanelSource } from "../src/infrastructure/convex/league-fixture-store"
import { loadLeaguePanels } from "../src/application/wardogs-league/league-panels"
import { leaguePanelsOn } from "../src/application/wardogs-league/tracking"
import { assertSessionGateway } from "./dashboardSessionStore"
import { trackingConfig } from "./leagueTrackingReads"
import { query } from "./_generated/server"
import { v } from "convex/values"

/**
 * View-models of the two WD League panels for one guild (bot worker,
 * dashboard preview). The League data is shared; the guild's watched team
 * codes mark "our" team. `enabled: false` when the workspace turned Wardogs
 * League off. Requires the internal secret. The bot reads this every minute
 * per clan, so the module projects stored data without Zod
 * (ARCHITECTURE.md, "Convex hot paths").
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
        // The options come from the stored panel, validated when it was
        // saved; the validator checked the shape, the range is checked here.
        const options = leaguePanelOptionsOf(
            args.options ?? DEFAULT_LEAGUE_PANEL_OPTIONS
        )
        const config = await trackingConfig(ctx, args.guildId)
        // Wardogs League turned off: the bot deletes the panel messages (L3-55).
        if (!leaguePanelsOn(config))
            return { enabled: false, standings: null, fixtures: null }
        const now = Date.now()
        return {
            enabled: true,
            ...(await loadLeaguePanels(convexLeaguePanelSource(ctx, now), {
                now,
                ourTeamCodes: config?.teamCodes ?? [],
                options,
            })),
        }
    },
})
