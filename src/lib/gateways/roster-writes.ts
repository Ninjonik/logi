import type { RosterDashboardActor } from "../../../convex/rosterWriterAccess"
import { appCacheTags, revalidateCacheEntries } from "../cache-tags"
import type { RosterWriteInput } from "../api/roster-write-route"
import { makeFunctionReference } from "convex/server"
import { isSuperadminDiscordId } from "../superadmin"
import { getInternalAuthSecret } from "../env"
import { fetchMutation } from "convex/nextjs"
import { getSession } from "../auth"

export async function currentRosterWriter(): Promise<RosterDashboardActor | null> {
    const session = await getSession()
    return session
        ? {
              sid: session.sid,
              subject: session.sub,
              userRecordId: session.userRecordId,
              superadmin: await isSuperadminDiscordId(session.sub),
          }
        : null
}

export async function writeRoster(
    serverId: string,
    actor: RosterDashboardActor,
    input: RosterWriteInput
): Promise<string> {
    const id = await fetchMutation(
        makeFunctionReference<"mutation">("rosters:upsert"),
        { ...input, secret: getInternalAuthSecret(), serverId, actor }
    )
    if (typeof id !== "string" || !id)
        throw new Error("Invalid roster response.")
    revalidateCacheEntries([
        appCacheTags.serverContext(serverId),
        appCacheTags.rosters(serverId),
        appCacheTags.roster(id),
        appCacheTags.event(input.eventId),
        appCacheTags.events(serverId),
        appCacheTags.rosterImage(),
    ])
    return id
}
