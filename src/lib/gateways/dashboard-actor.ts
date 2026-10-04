import type { DashboardActor } from "../../../convex/dashboardActor"
import { isSuperadminDiscordId } from "../superadmin"
import { getSession } from "../auth"

/** Never construct this actor from a request body or a cached workspace view. */
export async function currentDashboardActor(): Promise<DashboardActor | null> {
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
