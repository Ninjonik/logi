import { notFound, redirect } from "next/navigation"
import type { Metadata } from "next"

import {
    readWebApplicationPage,
    readWebApplicationStatus,
    webApplicant,
} from "@/lib/gateways/membership-application"
import {
    WebApplicationForm,
    type WebApplicationData,
} from "@/components/app/web-application/web-application-form"
import {
    PublicPage,
    PublicSiteShell,
} from "@/components/public/public-site-shell"
import { getDictionary } from "@/i18n/dictionaries"
import { isLocale } from "@/i18n/config"

type Params = Promise<{ locale: string; guildId: string }>

export async function generateMetadata({
    params,
}: {
    params: Params
}): Promise<Metadata> {
    const { locale } = await params
    const dictionary = getDictionary(isLocale(locale) ? locale : "en")
    return {
        title: dictionary.membershipApplication.title,
        robots: { index: false, follow: false },
    }
}

/**
 * The clan application on the Logi web (Variant B, L6-16, L6-17, N4-42).
 * It exists only while the clan has applications and the web switch on;
 * otherwise the page is not found. The applicant is the Discord account
 * signed in to Logi.
 */
export default async function WebApplicationPage({
    params,
}: {
    params: Params
}) {
    const { locale, guildId } = await params
    const safeLocale = isLocale(locale) ? locale : "en"
    if (!/^\d{17,20}$/.test(guildId)) notFound()
    const here = `/${safeLocale}/apply/${guildId}`
    const actor = await webApplicant()
    if (!actor)
        redirect(`/${safeLocale}/login?redirectTo=${encodeURIComponent(here)}`)
    const page = await readWebApplicationPage(actor, guildId)
    if (page.status === "signed-out")
        redirect(`/${safeLocale}/login?redirectTo=${encodeURIComponent(here)}`)
    if (page.status !== "ready") notFound()
    const { state } = page
    const status = await readWebApplicationStatus(actor, guildId)
    const data: WebApplicationData = {
        guildId,
        clanName: state.clanName,
        applicantName: page.applicantName,
        language: state.language,
        timeZone: state.timeZone,
        form: state.form,
        // The applicant sees what the form asks, not the clan's roles.
        categories: state.categories.map((category) => ({
            id: category.id,
            gameId: category.gameId,
            label: category.label,
            description: category.description,
            emoji: category.emoji,
            assignmentType: category.assignmentType,
            askSpecialization: category.askSpecialization,
        })),
        answers: state.draft?.answers ?? {
            games: [],
            accounts: {},
            answers: {},
            completedWindows: [],
        },
        verifiedSteamId: state.verifiedSteamId ?? null,
        previousPlayers: state.previousPlayers,
        linkedPlatformIds: state.linkedPlatformIds,
        status:
            status.state === "queued"
                ? { state: "queued" }
                : status.state === "failed"
                  ? { state: "failed", reason: status.reason }
                  : status.state === "done"
                    ? { state: "done", threadId: status.threadId }
                    : { state: "editing" },
    }
    const dictionary = getDictionary(safeLocale)
    return (
        <PublicSiteShell locale={safeLocale}>
            <PublicPage className="max-w-3xl">
                <WebApplicationForm
                    data={data}
                    t={dictionary.applicationWeb}
                    now={new Date().getTime()}
                />
            </PublicPage>
        </PublicSiteShell>
    )
}
