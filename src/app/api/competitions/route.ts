import { competitionAdminRoutes } from "@/lib/gateways/competition-admin"

export const runtime = "nodejs"

/** Global administration: every competition, published or not. */
export async function GET() {
    return await competitionAdminRoutes.list()
}

/** Global-administrator competition commands (`{ action, ... }`). */
export async function POST(request: Request) {
    return await competitionAdminRoutes.command(request)
}
