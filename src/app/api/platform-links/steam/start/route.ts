import { steamLinkHandlers } from "@/lib/gateways/platform-links"
export const runtime = "nodejs"
export async function POST(request: Request) {
    return steamLinkHandlers().start(request)
}
