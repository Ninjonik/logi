import type { DashboardActor } from "../../../convex/dashboardActor"
import { superadminAccess } from "./superadmin-route"

/** The image-asset scope Convex reserves for platform-owned uploads. */
export const PLATFORM_IMAGE_SCOPE = "platform"
export type PlatformImageAccess = {
    secret: string
    guildId: typeof PLATFORM_IMAGE_SCOPE
    actor: DashboardActor
}

/**
 * Upload access to the platform scope: only an attested global administrator,
 * and always the platform scope regardless of what the request names.
 */
export function platformImageAccess(
    actor: DashboardActor | null,
    secret: string
): PlatformImageAccess | null {
    const access = superadminAccess(actor, secret)
    return access ? { ...access, guildId: PLATFORM_IMAGE_SCOPE } : null
}
