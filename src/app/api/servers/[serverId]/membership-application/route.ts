import {
    attachMembershipPanelImage,
    membershipAdminAccess,
    verifyApplicationChannels,
} from "@/lib/gateways/membership-application"
import { membershipApplicationRoutes } from "@/lib/api/membership-application-route"
import { isDashboardWriteOrigin } from "@/lib/api/dashboard-write-origin"

export const runtime = "nodejs"
type Context = { params: Promise<{ serverId: string }> }

const routes = membershipApplicationRoutes({
    isWriteOrigin: isDashboardWriteOrigin,
    access: membershipAdminAccess,
    checkChannels: (access, channels) =>
        verifyApplicationChannels(access.guildId, channels),
    attachImage: attachMembershipPanelImage,
})

/** Channel checks and the panel image of the application settings (N4). */
export async function POST(request: Request, context: Context) {
    return routes.POST(request, await context.params)
}
