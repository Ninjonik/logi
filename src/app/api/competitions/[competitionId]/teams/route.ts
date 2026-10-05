import { competitionAdminRoutes } from "@/lib/gateways/competition-admin"

export const runtime = "nodejs"
type Context = { params: Promise<{ competitionId: string }> }

/** Active catalogue teams of the competition's game for the registration picker. */
export async function GET(request: Request, context: Context) {
    return await competitionAdminRoutes.searchTeams(
        request,
        (await context.params).competitionId
    )
}
