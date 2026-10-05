import { makeFunctionReference } from "convex/server"
import { fetchQuery } from "convex/nextjs"
import { z } from "zod"

import type { SettingsOverviewFacts } from "@/domain/workspaces/settings-overview"
import { gameServerSourceListSchema } from "@/domain/game-data/credentials"
import { currentDashboardActor } from "@/lib/gateways/dashboard-actor"
import { getInternalAuthSecret } from "@/lib/env"
import type { Guild } from "@/types/domain"

const sourcesReference = makeFunctionReference<"query">("gameDataSources:list")
const leagueReference = makeFunctionReference<"query">("leagueDiscovery:list")
const leagueSchema = z.object({
    settings: z.object({ enabled: z.boolean() }).nullable().optional(),
})

/**
 * What the settings overview shows beside the Discord settings (design A1).
 * Game servers and the league are read with the viewer's dashboard session,
 * so Convex checks the admin right again; a read that fails leaves its fact
 * unknown instead of failing the page.
 */
export async function getSettingsOverviewFacts(
    server: Guild,
    enabledGames: readonly string[]
): Promise<SettingsOverviewFacts> {
    const facts: SettingsOverviewFacts = {
        botInside: server.botInside,
        profile: {
            name: Boolean(server.name?.trim()),
            logo: Boolean(server.avatar?.trim()),
            description: Boolean(server.description?.trim()),
        },
        templateCount: server.matchTemplates?.length ?? 0,
    }
    const actor = await currentDashboardActor()
    if (!actor) return facts
    const args = {
        secret: getInternalAuthSecret(),
        guildId: server.discordId,
        actor,
    }
    const [sources, league] = await Promise.all([
        fetchQuery(sourcesReference, args)
            .then((value) =>
                gameServerSourceListSchema
                    .omit({ encryption: true })
                    .safeParse(value)
            )
            .catch(() => null),
        enabledGames.includes("wardogs")
            ? fetchQuery(leagueReference, args)
                  .then((value) => leagueSchema.safeParse(value))
                  .catch(() => null)
            : Promise.resolve(null),
    ])
    if (sources?.success) {
        const enabled = sources.data.sources.filter(
            (source) => source.collection?.enabled
        )
        const failing = enabled.filter(
            (source) => source.collection?.errorCategory || source.key.failure
        )
        facts.collectingServers = enabled.length - failing.length
        facts.failingServers = failing.length
    }
    if (league?.success)
        facts.leagueEnabled = league.data.settings?.enabled ?? false
    return facts
}
