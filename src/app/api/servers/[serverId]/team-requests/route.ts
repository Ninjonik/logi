/** Team profiles replace reviewed workspace requests; historical moderation remains in global administration. */
const retired = () =>
    Response.json(
        { error: "team_requests_retired" },
        { status: 410, headers: { "Cache-Control": "no-store" } }
    )
export const GET = retired
export const POST = retired
