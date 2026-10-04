import { dashboardLogout } from "@/lib/api/dashboard-logout"
import { clearSessionToken } from "@/lib/auth"
import { getSiteUrl } from "@/lib/env"

const handle = (request: Request) =>
    dashboardLogout(request, { issuer: getSiteUrl, revoke: clearSessionToken })

export const GET = handle
export const POST = handle
