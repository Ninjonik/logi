import { currentRosterWriter, writeRoster } from "@/lib/gateways/roster-writes"
import { rosterWriteHandler } from "@/lib/api/roster-write-route"
import { getSiteUrl } from "@/lib/env"

export const dynamic = "force-dynamic"
export async function POST(
    request: Request,
    { params }: { params: Promise<{ serverId: string }> }
) {
    const { serverId } = await params
    return rosterWriteHandler({
        origin: new URL(getSiteUrl()).origin,
        actor: currentRosterWriter,
        write: writeRoster,
    })(request, serverId)
}
