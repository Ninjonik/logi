import { websiteEventHandlers } from "@/lib/gateways/website-event-commands"
export const runtime = "nodejs"
export async function GET(
    request: Request,
    context: { params: Promise<{ eventId: string }> }
) {
    return websiteEventHandlers.GET(request, (await context.params).eventId)
}
