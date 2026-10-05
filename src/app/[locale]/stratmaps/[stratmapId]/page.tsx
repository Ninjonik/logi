import { notFound } from "next/navigation"
import type { Metadata } from "next"

import {
    getPublicImageDimensions,
    getPublicImageVersion,
} from "@/lib/public-image-version"
import { DynamicMetadataMarker } from "@/components/public/dynamic-metadata-marker"
import { StratmapEditor } from "@/components/app/stratmap-editor"
import { getPublicStratmapDetail } from "@/lib/server-stratmaps"
import { getStratmapMapById } from "@/lib/game-stratmaps"
import { getDictionary } from "@/i18n/dictionaries"
import { getLocalizedCanonical } from "@/lib/seo"
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
            robots: { index: false, follow: false },
        }
    }

    const mapDef = getStratmapMapById(stratmap.baseMapId, stratmap.gameId)
    const mapName = mapDef?.name ?? stratmap.baseMapId
    const strongpoint =
        stratmap.gameId === "wardogs"
            ? undefined
            : stratmap.strongpointId
              ? (mapDef?.strongpoints.find(
                    (sp) => sp.id === stratmap.strongpointId
                )?.label ?? stratmap.strongpointId)
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
        alternates: getLocalizedCanonical(
            safeLocale,
            `/stratmaps/${stratmapId}`
        ),
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
        <main className="bg-background h-dvh w-dvw overflow-hidden">
            <StratmapEditor
                locale={safeLocale}
                stratmapId={stratmapId}
                initialCanAdmin={false}
                initialStratmap={stratmap}
                dictionary={dictionary}
            />
            <DynamicMetadataMarker />
        </main>
    )
}
