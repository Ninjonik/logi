import type { Metadata } from "next"

import { SquadPresetEditor } from "@/components/app/squad-preset-editor"
import { getSquadPresetMetadata } from "@/lib/server-metadata"
import { PageHeader } from "@/components/app/page-header"
import { getServerContext } from "@/lib/server-context"
import { resolveGameScope } from "@/domain/games/game"
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
}: {
    params: Promise<{ locale: string; serverId: string; presetId: string }>
}) {
    const { locale, serverId, presetId } = await params
    const dictionary = getDictionary(isLocale(locale) ? locale : "en")
    // Squad groups are presentation labels, not membership links. Load every
    // workspace group so a preset remains able to reuse its group labels.
    const context = await getServerContext(serverId, "all")
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
