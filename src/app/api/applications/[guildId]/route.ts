import {
    readWebApplicationStatus,
    saveWebApplicationWindow,
    submitWebApplication,
    webApplicant,
} from "@/lib/gateways/membership-application"
import { isDashboardWriteOrigin } from "@/lib/api/dashboard-write-origin"
import { webApplicationRoutes } from "@/lib/api/web-application-route"

export const runtime = "nodejs"
type Context = { params: Promise<{ guildId: string }> }

const routes = webApplicationRoutes({
    isWriteOrigin: isDashboardWriteOrigin,
    applicant: webApplicant,
    status: readWebApplicationStatus,
    save: saveWebApplicationWindow,
    submit: submitWebApplication,
})

/** Where the signed-in applicant's web application is (Variant B). */
export async function GET(request: Request, context: Context) {
    return routes.GET(request, await context.params)
}

/** Saves a step or sends the web application (Variant B). */
export async function POST(request: Request, context: Context) {
    return routes.POST(request, await context.params)
}
