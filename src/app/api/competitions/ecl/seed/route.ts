import { competitionAdminRoutes } from "@/lib/gateways/competition-admin"

export const runtime = "nodejs"

/** Creates or completes ECL 2026 with global catalogue teams. */
export async function POST(request: Request) {
    return await competitionAdminRoutes.command(request, { action: "seedEcl" })
}
