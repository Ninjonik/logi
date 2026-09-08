import { makeFunctionReference } from "convex/server"
import { fetchQuery } from "convex/nextjs"
import type { Metadata } from "next"

import {
    PublicPage,
    PublicSiteShell,
} from "@/components/public/public-site-shell"
import { PlatformIdLinkForm } from "@/components/app/platform-id-link-form"
import { getDictionary } from "@/i18n/dictionaries"
import { isLocale } from "@/i18n/config"

const getPlatformIdLinkTokenReference = makeFunctionReference<"query">(
    "platformIdLinks:getPlatformIdLinkToken"
)

export const metadata: Metadata = {
    title: "Link platform ID",
    description: "Submit your platform ID for clan membership applications.",
}

export default async function LocalizedPlatformIdLinkPage({
    params,
}: {
    params: Promise<{ locale: string; token: string }>
}) {
    const { locale, token } = await params
    const safeLocale = isLocale(locale) ? locale : "en"
    const dictionary = getDictionary(safeLocale)
    const tokenRecord = await fetchQuery(getPlatformIdLinkTokenReference, {
        token,
    })

    const isExpired =
        !tokenRecord ||
        Boolean(tokenRecord.consumedAt) ||
        new Date(tokenRecord.expiresAt).getTime() < Date.now()

    return (
        <PublicSiteShell locale={safeLocale}>
            <PublicPage className="flex max-w-xl items-center">
                <div className="border-border/60 bg-card w-full rounded-3xl border p-8 shadow-sm">
                    <PlatformIdLinkForm
                        token={token}
                        userName={tokenRecord?.userName ?? "Discord user"}
                        expired={isExpired}
                        locale={safeLocale}
                        dictionary={dictionary}
                    />
                </div>
            </PublicPage>
        </PublicSiteShell>
    )
}
