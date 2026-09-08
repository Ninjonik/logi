import {
    listPublicCompetitions,
    linkCompetitionEvent,
} from "@/lib/read-models/competitions"
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags"
import { getServerContext } from "@/lib/server-context"
import { NextResponse } from "next/server"
function normalizeName(value: string) {
    return value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase()
        .replace(/[^a-z0-9]+/g, "")
}
export async function POST(
    request: Request,
    { params }: { params: Promise<{ serverId: string; eventId: string }> }
) {
    const { serverId, eventId } = await params
    const context = await getServerContext(serverId)
    if (!context?.canAdmin)
        return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    const event = context.events.find((item) => item.id === eventId)
    if (!event || event.kind !== "match")
        return NextResponse.json(
            { error: "Only match events can be linked." },
            { status: 400 }
        )
    const body = await request.json()
    const competition = (await listPublicCompetitions()).find(
        (item) => item.id === body.competitionId
    )
    const teamIds =
        competition?.divisions
            .flatMap((division) => division.teams)
            .filter(
                (team) =>
                    normalizeName(team.name) ===
                    normalizeName(context.server.name)
            )
            .map((team) => team.id) ?? []
    if (
        !body.competitionId ||
        !body.teamAId ||
        !body.teamBId ||
        (!teamIds.includes(body.teamAId) && !teamIds.includes(body.teamBId))
    )
        return NextResponse.json(
            { error: "Your clan must be one of the competing teams." },
            { status: 400 }
        )
    try {
        await linkCompetitionEvent({
            competitionId: body.competitionId,
            divisionId: body.divisionId,
            eventId,
            teamAId: body.teamAId,
            teamBId: body.teamBId,
        })
        revalidateCacheEntries([
            appCacheTags.event(eventId),
            appCacheTags.events(serverId),
            appCacheTags.serverContext(serverId),
        ])
        return NextResponse.json({ ok: true })
    } catch {
        return NextResponse.json(
            { error: "Unable to link this match." },
            { status: 500 }
        )
    }
}
