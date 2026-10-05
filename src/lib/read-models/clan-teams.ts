import { makeFunctionReference } from "convex/server"
import { fetchQuery } from "convex/nextjs"

import type { TeamDto } from "@/domain/teams/team"
import { getInternalAuthSecret } from "@/lib/env"

const linkedTeamsReference = makeFunctionReference<"query">("clanTeams:linked")

/** Catalogue teams that represent this clan; empty when none is linked or the read fails. */
export async function getLinkedClanTeams(
    discordGuildId: string
): Promise<TeamDto[]> {
    try {
        return (await fetchQuery(linkedTeamsReference, {
            secret: getInternalAuthSecret(),
            guildId: discordGuildId,
        })) as TeamDto[]
    } catch {
        return []
    }
}
