import { teamImageHandlers } from "@/lib/gateways/team-images"
export const runtime = "nodejs"
type Context = { params: Promise<{ teamId: string }> }
export async function POST(request: Request, context: Context) {
    const url = new URL(request.url)
    url.searchParams.set("kind", "team-logo")
    return teamImageHandlers.POST(
        new Request(url, request),
        (await context.params).teamId
    )
}
