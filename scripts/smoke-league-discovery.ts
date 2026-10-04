import {
    fetchLeagueIndex,
    fetchLeagueMatch,
} from "../src/infrastructure/wardogs-league/fetch-match"
import {
    INDEX_URLS,
    matchesWatchedTeams,
} from "../src/domain/wardogs-league/discovery"
async function main() {
    const pages = []
    for (const url of INDEX_URLS) {
        const result = await fetchLeagueIndex(url)
        pages.push({
            url,
            count: result.matchUrls.length,
            incomplete: result.incomplete,
            referenceFound: result.matchUrls.includes(
                "https://wardogsleague.net/matches/cmuqt8ep605e1lf018w2nlywu"
            ),
        })
    }
    const match = await fetchLeagueMatch(
        "https://wardogsleague.net/matches/cmuqt8ep605e1lf018w2nlywu"
    )
    if (!pages[0].referenceFound || !matchesWatchedTeams(match, ["VLK"]))
        throw new Error("Reference fixture discovery failed.")
    console.log(
        JSON.stringify(
            {
                checkedAt: new Date().toISOString(),
                pages,
                match: {
                    id: match.id,
                    status: match.status,
                    scheduledAt: match.scheduledAt,
                    teams: match.teams?.map((t) => ({
                        code: t.code,
                        faction: t.faction,
                    })),
                    results: match.results,
                },
            },
            null,
            2
        )
    )
}
void main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Discovery failed")
    process.exitCode = 1
})
