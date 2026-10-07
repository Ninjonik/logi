import {
    activeDashboardSession,
    assertSessionGateway,
} from "./dashboardSessionStore"
import type { DashboardActor } from "./dashboardActor"
import type { QueryCtx } from "./_generated/server"

/** Asset/audit scope for records owned by the platform rather than a workspace. */
export const PLATFORM_SCOPE = "platform"

/**
 * Global administration (team catalogue, request decisions, competitions)
 * requires a current dashboard session whose superadmin attestation comes from
 * the authenticated web gateway's operator configuration. Evaluated in the same
 * transaction as the write.
 */
export async function authorizePlatformAdmin(
    ctx: Pick<QueryCtx, "db">,
    input: { secret: string; actor: DashboardActor }
) {
    assertSessionGateway(input.secret)
    if (!input.actor?.superadmin) throw new Error("Forbidden.")
    const active = await activeDashboardSession(
        ctx,
        input.actor.sid,
        input.actor.subject,
        input.actor.userRecordId
    )
    if (!active) throw new Error("Forbidden.")
    return active
}
