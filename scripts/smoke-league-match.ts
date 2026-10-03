/** Anonymous GET only; no environment, credentials or database required. */
import { fetchLeagueMatch } from "../src/infrastructure/wardogs-league/fetch-match"
fetchLeagueMatch(
    process.argv[2] ??
        "https://wardogsleague.net/matches/cmuqt8ep605e1lf018w2nlywu"
)
    .then((value) => console.log(JSON.stringify(value, null, 2)))
    .catch((error) => {
        console.error(
            error instanceof Error ? error.message : "Match read failed"
        )
        process.exitCode = 1
    })
