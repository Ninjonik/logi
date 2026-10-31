import {
    readLeagueAccount,
    writeLeagueAccount,
} from "@/lib/gateways/league-portal"
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags"
import { leagueCommandSchema } from "@/domain/leagues/portal"
import { readBoundedJson } from "@/lib/api/request-json"
import { revalidatePath } from "next/cache"
import { getSiteUrl } from "@/lib/env"
export const runtime = "nodejs"
const reply = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: { "Cache-Control": "no-store" } })
/** Account-session API: clan/service keys cannot confer personal team ownership. */
export async function GET(request: Request) {
    try {
        const competitionId = new URL(request.url).searchParams.get(
            "competitionId"
        )
        if (competitionId && competitionId.length > 64)
            return reply({ error: "invalid_input" }, 400)
        const data = await readLeagueAccount(competitionId)
        return data ? reply({ data }) : reply({ error: "unauthorized" }, 401)
    } catch {
        return reply({ error: "unavailable" }, 503)
    }
}
export async function POST(request: Request) {
    const origin = request.headers.get("origin"),
        url = new URL(request.url)
    const local =
        process.env.NODE_ENV === "development" &&
        ["localhost", "127.0.0.1"].includes(url.hostname) &&
        origin === url.origin
    if (origin !== new URL(getSiteUrl()).origin && !local)
        return reply({ error: "forbidden" }, 403)
    const parsed = leagueCommandSchema.safeParse(
        await readBoundedJson(request, 4096)
    )
    if (!parsed.success) return reply({ error: "invalid_input" }, 400)
    try {
        const result = await writeLeagueAccount(parsed.data)
        if (!result) return reply({ error: "unauthorized" }, 401)
        if ("error" in result)
            return reply(result, result.error === "forbidden" ? 403 : 409)
        revalidateCacheEntries([
            appCacheTags.publicDiscovery(),
            result.slug ? appCacheTags.competition(result.slug) : null,
            ...(result.competitionSlugs ?? []).map(appCacheTags.competition),
            result.guildId ? appCacheTags.publicClan(result.guildId) : null,
        ])
        revalidatePath("/[locale]/leagues", "layout")
        revalidatePath("/[locale]/league-teams", "page")
        revalidatePath("/[locale]/dashboard", "layout")
        return reply(result)
    } catch {
        return reply({ error: "unavailable" }, 503)
    }
}
