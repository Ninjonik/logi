import { steamLinkHandlers } from "@/lib/gateways/platform-links"
export const runtime = "nodejs"
export async function GET() {
    return steamLinkHandlers().status()
}
export async function DELETE(request: Request) {
    return steamLinkHandlers().unlink(request)
}
