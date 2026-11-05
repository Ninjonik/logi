import { providerKeySchema } from "../../domain/game-data/credentials.schema"
import { teamFixturesSchema } from "../../domain/wardogs-league/team-api"

/** Fixed origin, no redirects carrying credentials, bounded response and deadline. */
export async function fetchTeamFixtures(
    apiKey: string,
    fetcher: typeof fetch = fetch
) {
    const key = providerKeySchema.parse(apiKey)
    const response = await fetcher(
        "https://wardogsleague.net/api/v1/team/fixtures?limit=20",
        {
            headers: {
                Authorization: `Bearer ${key}`,
                Accept: "application/json",
            },
            redirect: "error",
            signal: AbortSignal.timeout(15_000),
        }
    )
    if (!response.ok)
        throw new Error(
            response.status === 401 || response.status === 403
                ? "Wardogs API key was rejected."
                : "Wardogs API is unavailable."
        )
    if (!response.body) throw new Error("Wardogs API returned no data.")
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            size += value.byteLength
            if (size > 1024 * 1024)
                throw new Error("Wardogs API response is too large.")
            chunks.push(value)
        }
    } finally {
        await reader.cancel()
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
        bytes.set(chunk, offset)
        offset += chunk.byteLength
    }
    return teamFixturesSchema.parse(JSON.parse(new TextDecoder().decode(bytes)))
}
