import { notFound } from "next/navigation"
import type { Metadata } from "next"

import {
    getPublicClanPageDetails,
    profileOnlyDetails,
} from "@/lib/read-models/public-clan-page"
import {
    getPublicImageDimensions,
    getPublicImageVersion,
} from "@/lib/public-image-version"
import {
    PublicPage,
    PublicSiteShell,
} from "@/components/public/public-site-shell"
import { DynamicMetadataMarker } from "@/components/public/dynamic-metadata-marker"
import { getGuildPerformanceHistory } from "@/lib/read-models/performance-history"
import { getPublicPreviewMetadata } from "@/lib/public-preview-metadata"
import { PublicClanView } from "@/components/public/public-clan-view"
import { getPublicClan } from "@/lib/read-models/public-profiles"
import { getDictionary } from "@/i18n/dictionaries"
import { getLocalizedCanonical } from "@/lib/seo"
import { isLocale } from "@/i18n/config"

type Props = { params: Promise<{ locale: string; guildId: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale, guildId } = await params
    const safeLocale = isLocale(locale) ? locale : "en"
    const preview = await getPublicPreviewMetadata("clan", guildId)
    const title = preview?.title ?? "Clan profile"
    const description =
        preview?.description ??
        "Public clan profile and recorded match history."
    const imageVersion = getPublicImageVersion(
        preview?.imageVersion ?? "current"
    )
    const image = `/api/og/clan/${guildId}?v=${encodeURIComponent(imageVersion)}`
    const imageDimensions = getPublicImageDimensions(imageVersion)
    return {
        title,
        description,
        alternates: getLocalizedCanonical(safeLocale, `/clans/${guildId}`),
        openGraph: {
            title,
            description,
            images: [{ url: image, ...imageDimensions }],
        },
        twitter: { card: "summary_large_image", images: [image] },
    }
}

export default async function PublicClanPage({ params }: Props) {
    const { locale, guildId } = await params
    const resolvedLocale = isLocale(locale) ? locale : "en"
    const clan = await getPublicClan(guildId)
    if (!clan) notFound()
    const [details, performanceHistory] = await Promise.all([
        getPublicClanPageDetails(guildId),
        getGuildPerformanceHistory(guildId),
    ])

    return (
        <PublicSiteShell locale={resolvedLocale} current="community">
            <PublicPage>
                <PublicClanView
                    clan={clan}
                    details={details ?? profileOnlyDetails(clan)}
                    performanceHistory={performanceHistory}
                    locale={resolvedLocale}
                    dictionary={getDictionary(resolvedLocale)}
                />
                <DynamicMetadataMarker />
            </PublicPage>
        </PublicSiteShell>
    )
}
