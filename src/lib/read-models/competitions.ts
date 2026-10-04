import type { PublicCompetition } from "@/domain/competitions/competition"
import { cachedRead, appCacheTags } from "@/lib/cache-tags"
import { makeFunctionReference } from "convex/server"
import { fetchQuery } from "convex/nextjs"

export type {
    PublicCompetition,
    PublicCompetitionFixture,
    PublicCompetitionTeam,
} from "@/domain/competitions/competition"

const getPublicReference = makeFunctionReference<"query">(
    "competitions:getPublic"
)
const listPublicSlugsReference = makeFunctionReference<"query">(
    "competitions:listPublicSlugs"
)

/** A published competition with global catalogue teams; unpublished ones read as `null`. */
export async function getPublicCompetition(slug: string) {
    return await cachedRead(
        ["competition", slug],
        [appCacheTags.competition(slug)],
        async () =>
            (await fetchQuery(getPublicReference, {
                slug,
            })) as PublicCompetition | null,
        300
    )
}

/** Every published competition, for the public listing. */
export async function listPublicCompetitions() {
    const slugs = (await fetchQuery(listPublicSlugsReference, {})) as string[]
    return (await Promise.all(slugs.map(getPublicCompetition))).filter(
        (competition): competition is PublicCompetition => Boolean(competition)
    )
}
