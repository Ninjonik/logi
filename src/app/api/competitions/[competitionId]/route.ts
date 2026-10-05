import { competitionAdminRoutes } from "@/lib/gateways/competition-admin"

export const runtime = "nodejs"
type Context = { params: Promise<{ competitionId: string }> }

/** One competition with divisions, registrations and fixtures for management. */
export async function GET(_request: Request, context: Context) {
    return await competitionAdminRoutes.get(
        (await context.params).competitionId
    )
}
