import { competitionAdminRoutes } from "@/lib/gateways/competition-admin"

export const runtime = "nodejs"
type Context = { params: Promise<{ fixtureId: string }> }

/** Native match events a fixture can be linked to. */
export async function GET(_request: Request, context: Context) {
    return await competitionAdminRoutes.linkCandidates(
        (await context.params).fixtureId
    )
}
