"use client"

import { makeFunctionReference } from "convex/server"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "convex/react"
import { toast } from "sonner"

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { importMapsLetLooseJson } from "@/domain/stratmaps/import-maps-let-loose"
import { HllMapSelector } from "@/components/app/hll-map-selector"
import { getStratmapMaps } from "@/lib/game-stratmaps"
import type { Dictionary } from "@/i18n/dictionaries"
import type { GameId } from "@/domain/games/game"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

const createStratmapReference =
    makeFunctionReference<"mutation">("stratmaps:create")

export function StratmapCreateForm({
    locale,
    serverId,
    userId,
    dictionary,
    defaultTitle = "",
    gameId,
}: {
    locale: string
    serverId: string
    userId: string
    dictionary: Dictionary
    defaultTitle?: string
    gameId?: GameId
}) {
    const router = useRouter()
    const createStratmap = useMutation(createStratmapReference)
    const [isPending, startTransition] = useTransition()
    const maps = getStratmapMaps(gameId)
    const [title, setTitle] = useState(defaultTitle)
    const [baseMapId, setBaseMapId] = useState(maps[0]?.id ?? "carentan")
    const [side, setSide] = useState("")
    const [strongpointId, setStrongpointId] = useState("")
    const [importState, setImportState] = useState<string | null>(null)
    const [importSummary, setImportSummary] = useState<string | null>(null)

    async function handleImport(file: File | undefined) {
        if (!file) return
        try {
            const imported = importMapsLetLooseJson(
                JSON.parse(await file.text())
            )
            if (imported.baseMapId) setBaseMapId(imported.baseMapId)
            setStrongpointId("")
            setImportState(JSON.stringify(imported.state))
            setImportSummary(
                dictionary.stratmaps.importSummary
                    .replace("{slides}", String(imported.state.slides.length))
                    .replace(
                        "{skipped}",
                        imported.skippedElements
                            ? `; ${imported.skippedElements} unsupported item${imported.skippedElements === 1 ? "" : "s"} skipped`
                            : ""
                    )
            )
        } catch (error) {
            console.error(error)
            toast.error(dictionary.stratmaps.importInvalid)
        }
    }

    async function handleSubmit() {
        if (!title.trim()) {
            toast.error(dictionary.stratmaps.titleRequired)
            return
        }

        startTransition(async () => {
            try {
                const stratmapId = await createStratmap({
                    userId,
                    serverId: serverId as never,
                    gameId,
                    title: title.trim(),
                    baseMapId,
                    side: side.trim() || undefined,
                    strongpointId: strongpointId || undefined,
                    state: importState ?? undefined,
                })

                router.push(
                    `/${locale}/dashboard/servers/${serverId}/stratmaps/${stratmapId}`
                )
            } catch (error) {
                console.error(error)
                toast.error(dictionary.stratmaps.createError)
            }
        })
    }

    return (
        <Card className="border-border/60 rounded-2xl">
            <CardHeader>
                <CardTitle>{dictionary.stratmaps.createTitle}</CardTitle>
                <CardDescription>
                    {dictionary.stratmaps.createDescription}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 overflow-x-hidden">
                <div className="space-y-2">
                    <Label>{dictionary.stratmaps.titleLabel}</Label>
                    <Input
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        className="min-w-0 overflow-hidden rounded-xl"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="maps-let-loose-import">
                        {dictionary.stratmaps.importLabel}
                    </Label>
                    <Input
                        id="maps-let-loose-import"
                        type="file"
                        accept="application/json,.json"
                        onChange={(event) =>
                            handleImport(event.target.files?.[0])
                        }
                    />
                    <p className="text-muted-foreground text-sm">
                        {dictionary.stratmaps.importHint}
                    </p>
                    {importSummary ? (
                        <p className="text-sm text-emerald-600">
                            {importSummary}
                        </p>
                    ) : null}
                </div>
                <div className="space-y-2">
                    <Label>{dictionary.stratmaps.mapAndPoint}</Label>
                    <HllMapSelector
                        gameId={gameId}
                        mapId={baseMapId}
                        onMapIdChange={(value) => {
                            setBaseMapId(value)
                            setStrongpointId("")
                        }}
                        pointValue={strongpointId}
                        onPointValueChange={setStrongpointId}
                        pointValueMode="id"
                        sideValue={side}
                        onSideValueChange={setSide}
                        includeVariants={false}
                        includePoint={true}
                        includeSide={true}
                        labels={{
                            map: dictionary.stratmaps.baseMap,
                            mapSearch: dictionary.stratmaps.searchMap,
                            time: "Variant",
                            mode: "Mode",
                            point: dictionary.stratmaps.point,
                            pointSearch: dictionary.stratmaps.searchPoint,
                            side: dictionary.stratmaps.side,
                            optional: dictionary.event.optionalLabel,
                            noResults: dictionary.stratmaps.noResults,
                        }}
                    />
                </div>
                <Button
                    className="rounded-xl"
                    onClick={handleSubmit}
                    disabled={isPending}
                >
                    {dictionary.stratmaps.createTitle}
                </Button>
            </CardContent>
        </Card>
    )
}
