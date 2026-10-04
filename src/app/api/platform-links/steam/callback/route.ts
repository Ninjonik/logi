import { steamLinkHandlers } from "@/lib/gateways/platform-links"
export const runtime = "nodejs"
export async function GET(request: Request) {
    return steamLinkHandlers().callback(request)
}
