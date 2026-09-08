import type { Metadata } from "next"

import { PublicShareLinkButton } from "@/components/app/public-share-link-button"
import { StratmapEditor } from "@/components/app/stratmap-editor"
import { getPublicStratmapDetail } from "@/lib/server-stratmaps"
import { PageHeader } from "@/components/app/page-header"
import { getServerContext } from "@/lib/server-context"
import { getHllStratmapMapById } from "@/lib/stratmaps"
import { getDictionary } from "@/i18n/dictionaries"
import { isLocale } from "@/i18n/config"

type Props = {
    params: Promise<{ locale: string; serverId: string; stratmapId: string }>
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
    const image = `/api/og/stratmap/${stratmapId}?v=${encodeURIComponent(stratmap.updatedAt || "current")}`

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            images: [
                {
                    url: image,
                    width: 1200,
                    height: 630,
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

export default async function StratmapDetailPage({ params }: Props) {
    const { locale, serverId, stratmapId } = await params
    const safeLocale = isLocale(locale) ? locale : "en"
    const dictionary = getDictionary(safeLocale)
    const context = await getServerContext(serverId)

    if (!context) {
        return null
    }

    const stratmap = context.stratmaps.find((item) => item.id === stratmapId)
    if (!stratmap) {
        return null
    }

    return (
        <div className="grid h-[calc(100dvh-var(--header-height)-var(--footer-height)-1.5rem)] max-h-[calc(100dvh-var(--header-height)-var(--footer-height)-1.5rem)] min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden sm:h-[calc(100dvh-var(--header-height)-var(--footer-height)-2rem)] sm:max-h-[calc(100dvh-var(--header-height)-var(--footer-height)-2rem)] 2xl:h-[calc(100dvh-var(--header-height)-var(--footer-height)-3rem)] 2xl:max-h-[calc(100dvh-var(--header-height)-var(--footer-height)-3rem)]">
            <PageHeader
                title={stratmap.title}
                description={
                    stratmap.description ??
                    dictionary.stratmaps.detailDescription
                }
                actions={
                    context.canAdmin ? (
                        <PublicShareLinkButton
                            href={`/${safeLocale}/stratmaps/${stratmapId}`}
                            dictionary={dictionary}
                        />
                    ) : undefined
                }
            />
            <div className="min-h-0 flex-1 overflow-hidden px-4 pt-2 lg:px-6 2xl:pt-4">
                <div className="h-full overflow-hidden">
                    <StratmapEditor
                        locale={locale}
                        userId={context.user.discordId}
                        stratmapId={stratmapId}
                        initialCanAdmin={context.canAdmin}
                        initialStratmap={stratmap}
                        dictionary={dictionary}
                    />
                </div>
            </div>
        </div>
    )
}
