import { notFound } from "next/navigation"
import type { Metadata } from "next"

import {
    getPublicImageDimensions,
    getPublicImageVersion,
} from "@/lib/public-image-version"
import { DynamicMetadataMarker } from "@/components/public/dynamic-metadata-marker"
import { PublicBreadcrumbs } from "@/components/public/public-breadcrumbs"
import { PublicSiteShell } from "@/components/public/public-site-shell"
import { StratmapEditor } from "@/components/app/stratmap-editor"
import { getPublicStratmapDetail } from "@/lib/server-stratmaps"
import { getHllStratmapMapById } from "@/lib/stratmaps"
import { getDictionary } from "@/i18n/dictionaries"
import { isLocale } from "@/i18n/config"

type Props = {
    params: Promise<{ locale: string; stratmapId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale, stratmapId } = await params
    const safeLocale = isLocale(locale) ? locale : "en"
    const dictionary = getDictionary(safeLocale)
    const stratmap = await getPublicStratmapDetail(stratmapId)

    if (!stratmap) {
        return {
            title: `${dictionary.stratmaps.title} | ${dictionary.app.name}`,
            description: dictionary.stratmaps.pageDescription,
        }
    }

    const mapDef = getHllStratmapMapById(stratmap.baseMapId)
    const mapName = mapDef?.name ?? stratmap.baseMapId
    const strongpoint = stratmap.strongpointId
        ? (mapDef?.strongpoints.find((sp) => sp.id === stratmap.strongpointId)
              ?.label ?? stratmap.strongpointId)
        : undefined

    const title = `${stratmap.title} · ${mapName} | ${dictionary.app.name}`
    const descriptionParts = [
        stratmap.description,
        mapName,
        stratmap.side ? `${stratmap.side.toUpperCase()}` : undefined,
        strongpoint ? `Objective: ${strongpoint}` : undefined,
        dictionary.stratmaps.detailDescription,
    ].filter(Boolean)

    const description = descriptionParts.join(" · ")
    const imageVersion = getPublicImageVersion(stratmap.updatedAt || "current")
    const image = `/api/og/stratmap/${stratmapId}?v=${encodeURIComponent(imageVersion)}`
    const imageDimensions = getPublicImageDimensions(imageVersion)

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            images: [
                {
                    url: image,
                    ...imageDimensions,
                    alt: stratmap.title,
                },
            ],
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
            images: [image],
        },
    }
}

export default async function PublicStratmapPage({ params }: Props) {
    const { locale, stratmapId } = await params
    const safeLocale = isLocale(locale) ? locale : "en"
    const dictionary = getDictionary(safeLocale)
    const stratmap = await getPublicStratmapDetail(stratmapId)

    if (!stratmap) {
        notFound()
    }

    return (
        <PublicSiteShell locale={safeLocale}>
            <main className="flex flex-1 flex-col overflow-hidden px-3 py-4 sm:px-6 sm:py-5 lg:px-8">
                <div className="flex h-[calc(100dvh-4rem-3.5rem-2rem)] min-h-[560px] flex-col gap-3">
                    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
                        <PublicBreadcrumbs
                            items={[
                                {
                                    label: dictionary.app.name,
                                    href: `/${safeLocale}`,
                                },
                                { label: dictionary.stratmaps.title },
                                { label: stratmap.title },
                            ]}
                        />
                    </div>
                    <div className="border-border/70 bg-card/20 min-h-0 flex-1 overflow-hidden rounded-xl border shadow-sm">
                        <StratmapEditor
                            locale={safeLocale}
                            userId="public"
                            stratmapId={stratmapId}
                            initialCanAdmin={false}
                            initialStratmap={stratmap}
                            dictionary={dictionary}
                        />
                    </div>
                </div>
            </main>
            <DynamicMetadataMarker />
        </PublicSiteShell>
    )
}
