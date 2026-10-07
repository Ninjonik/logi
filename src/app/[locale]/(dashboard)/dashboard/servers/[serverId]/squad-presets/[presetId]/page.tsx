import type { Metadata } from "next"

import { PresetDeleteButton } from "@/components/app/preset-delete-button"
import { filterByGameScope, resolveGameScope } from "@/domain/games/game"
import { SquadPresetEditor } from "@/components/app/squad-preset-editor"
import { getSquadPresetMetadata } from "@/lib/server-metadata"
import { PageHeader } from "@/components/app/page-header"
import { getServerContext } from "@/lib/server-context"
import { getDictionary } from "@/i18n/dictionaries"
import { isLocale } from "@/i18n/config"

export const metadata: Metadata = {
    title: "Squad preset",
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
    const context = await getServerContext(serverId, "all")
    if (!context) return null
    const { squadPresets, canAdmin } = context
    const preset = squadPresets.find((item) => item.id === presetId)

    if (!preset) return null

    const groups = filterByGameScope(
        context.groups ?? [],
        resolveGameScope(preset.gameId)
    )

    return (
        <>
            <PageHeader
                title={preset.name}
                description={dictionary.presets.squadPresetPageDescription}
                actions={
                    canAdmin ? (
                        <PresetDeleteButton
                            serverId={serverId}
                            locale={locale}
                            kind="squad"
                            presetId={preset.id}
                            presetName={preset.name}
                            dictionary={dictionary}
                        />
                    ) : undefined
                }
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
