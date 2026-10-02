import type { Metadata } from "next"

import { SquadPresetEditor } from "@/components/app/squad-preset-editor"
import { isGameId, resolveGameScope } from "@/domain/games/game"
import { getSquadPresetMetadata } from "@/lib/server-metadata"
import { PageHeader } from "@/components/app/page-header"
import { getServerContext } from "@/lib/server-context"
import { getDictionary } from "@/i18n/dictionaries"
import { isLocale } from "@/i18n/config"

export const metadata: Metadata = {
    title: "Squad preset | Logi",
    description: "Preset squad structure for new rosters.",
}

export function generateStaticParams() {
    return [{ presetId: "sample-squad-preset" }]
}

export default async function SquadPresetDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string; serverId: string; presetId: string }>
    searchParams: Promise<{ game?: string }>
}) {
    const { locale, serverId, presetId } = await params
    const { game } = await searchParams
    const dictionary = getDictionary(isLocale(locale) ? locale : "en")
    const selectedGame = isGameId(game) ? game : undefined
    const context = await getServerContext(serverId, selectedGame ?? "all")
    if (!context) return null
    const { squadPresets, canAdmin, groups = [] } = context
    const preset = squadPresets.find((item) => item.id === presetId)

    if (!preset) return null

    return (
        <>
            <PageHeader
                title={preset.name}
                description={dictionary.presets.squadPresetPageDescription}
            />
            <div className="px-4 lg:px-6">
                <SquadPresetEditor
                    name={preset.name}
                    squads={preset.squads}
                    groups={groups}
                    canEdit={canAdmin}
                    dictionary={dictionary}
                    serverId={serverId}
                    locale={locale}
                    presetId={preset.id}
                    gameId={resolveGameScope(preset.gameId)}
                />
            </div>
        </>
    )
}
