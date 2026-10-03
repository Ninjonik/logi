import { redirect } from "next/navigation"
import type { Metadata } from "next"

import {
    getPublicStratmapDetail,
    getStratmapDetail,
} from "@/lib/server-stratmaps"
import { PublicShareLinkButton } from "@/components/app/public-share-link-button"
import { StratmapEditor } from "@/components/app/stratmap-editor"
import { DEFAULT_GAME_ID, isGameId } from "@/domain/games/game"
import { PageHeader } from "@/components/app/page-header"
import { getStratmapMapById } from "@/lib/game-stratmaps"
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

export default async function StratmapDetailPage({
    params,
    searchParams,
}: Props & { searchParams: Promise<{ game?: string }> }) {
    const { locale, serverId, stratmapId } = await params
    const { game } = await searchParams
    const safeLocale = isLocale(locale) ? locale : "en"
    const dictionary = getDictionary(safeLocale)
    const detail = await getStratmapDetail(stratmapId)

    if (!detail || detail.serverId !== serverId) {
        return null
    }

    const stratmap = detail.stratmap
    const stratmapGameId = stratmap.gameId ?? DEFAULT_GAME_ID
    if (game !== stratmapGameId) {
        redirect(
            `/${safeLocale}/dashboard/servers/${serverId}/stratmaps/${stratmapId}?game=${stratmapGameId}`
        )
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
                    detail.canAdmin ? (
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
                        userId={detail.userId}
                        stratmapId={stratmapId}
                        initialCanAdmin={detail.canAdmin}
                        initialStratmap={stratmap}
                        dictionary={dictionary}
                    />
                </div>
            </div>
        </div>
    )
}
