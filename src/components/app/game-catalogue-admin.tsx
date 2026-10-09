"use client"

import { useState } from "react"

import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Capability =
    | "maps"
    | "stratmaps"
    | "serverData"
    | "playerStats"
    | "matchResults"
    | "competitions"

type Game = {
    id: string
    name: string
    iconAssetId: string | null
    capabilities: Record<Capability, boolean>
    eventSelection: {
        primaryLabel: string
        primaryOptions: string[]
        targetLabel?: string
        targetOptional: boolean
    }
}

/** Global superadmin editor for capability-driven game definitions. */
export function GameCatalogueAdmin({
    initialGames,
    dictionary,
}: {
    initialGames: Game[]
    dictionary: Dictionary["gameCatalogue"]
}) {
    const capabilityLabels: Record<Capability, string> = {
        maps: dictionary.capabilities.maps,
        stratmaps: dictionary.capabilities.stratmaps,
        serverData: dictionary.capabilities.serverData,
        playerStats: dictionary.capabilities.playerStats,
        matchResults: dictionary.capabilities.matchResults,
        competitions: dictionary.capabilities.competitions,
    }
    const [games, setGames] = useState(initialGames)
    const [selectedId, setSelectedId] = useState(games[0]?.id ?? "")
    const selected = games.find((game) => game.id === selectedId) ?? null
    const [saving, setSaving] = useState(false)
    const [notice, setNotice] = useState<string | null>(null)

    const update = (changes: Partial<Game>) =>
        selected &&
        setGames((current) =>
            current.map((game) =>
                game.id === selected.id ? { ...game, ...changes } : game
            )
        )

    function createGame() {
        const id = `game_${Date.now()}`
        setGames((current) => [
            ...current,
            {
                id,
                name: dictionary.newGameName,
                iconAssetId: null,
                capabilities: {
                    maps: false,
                    stratmaps: false,
                    serverData: false,
                    playerStats: false,
                    matchResults: false,
                    competitions: false,
                },
                eventSelection: {
                    primaryLabel: dictionary.defaultEventSelectionLabel,
                    primaryOptions: [],
                    targetOptional: true,
                },
            },
        ])
        setSelectedId(id)
    }

    async function save() {
        if (!selected) return
        setSaving(true)
        setNotice(null)
        const response = await fetch("/api/superadmin/games", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(selected),
        }).catch(() => null)
        setSaving(false)
        setNotice(response?.ok ? dictionary.saved : dictionary.saveFailed)
    }

    return (
        <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="border-border rounded-xl border p-2">
                <Button
                    variant="outline"
                    className="mb-2 w-full"
                    onClick={createGame}
                >
                    {dictionary.addGame}
                </Button>
                {games.map((game) => (
                    <button
                        key={game.id}
                        type="button"
                        onClick={() => setSelectedId(game.id)}
                        className={`w-full rounded-lg px-3 py-2 text-left text-sm ${selectedId === game.id ? "bg-muted font-semibold" : "hover:bg-muted/60"}`}
                    >
                        {game.name}
                    </button>
                ))}
            </aside>
            {selected ? (
                <section className="space-y-5 rounded-xl border p-5">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-1.5 text-sm">
                            {dictionary.gameId}
                            <Input
                                value={selected.id}
                                onChange={(event) => {
                                    const id = event.target.value
                                    update({ id })
                                    setSelectedId(id)
                                }}
                            />
                        </label>
                        <label className="grid gap-1.5 text-sm">
                            {dictionary.managedIconAssetId}
                            <Input
                                value={selected.iconAssetId ?? ""}
                                onChange={(event) =>
                                    update({
                                        iconAssetId:
                                            event.target.value.trim() || null,
                                    })
                                }
                            />
                        </label>
                        <label className="grid gap-1.5 text-sm">
                            {dictionary.displayName}
                            <Input
                                value={selected.name}
                                onChange={(event) =>
                                    update({ name: event.target.value })
                                }
                            />
                        </label>
                    </div>
                    <div>
                        <h2 className="font-semibold">
                            {dictionary.capabilities.title}
                        </h2>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            {(
                                Object.keys(capabilityLabels) as Capability[]
                            ).map((key) => (
                                <label
                                    key={key}
                                    className="flex items-center gap-2 text-sm"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selected.capabilities[key]}
                                        onChange={(event) =>
                                            update({
                                                capabilities: {
                                                    ...selected.capabilities,
                                                    [key]: event.target.checked,
                                                },
                                            })
                                        }
                                    />
                                    {capabilityLabels[key]}
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-1.5 text-sm">
                            {dictionary.eventSelectionLabel}
                            <Input
                                value={selected.eventSelection.primaryLabel}
                                onChange={(event) =>
                                    update({
                                        eventSelection: {
                                            ...selected.eventSelection,
                                            primaryLabel: event.target.value,
                                        },
                                    })
                                }
                            />
                        </label>
                        <label className="grid gap-1.5 text-sm">
                            {dictionary.optionsOnePerLine}
                            <textarea
                                className="border-input min-h-24 rounded-md border bg-transparent px-3 py-2 text-sm"
                                value={selected.eventSelection.primaryOptions.join(
                                    "\n"
                                )}
                                onChange={(event) =>
                                    update({
                                        eventSelection: {
                                            ...selected.eventSelection,
                                            primaryOptions: event.target.value
                                                .split("\n")
                                                .map((item) => item.trim())
                                                .filter(Boolean),
                                        },
                                    })
                                }
                            />
                        </label>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-1.5 text-sm">
                            {dictionary.optionalTargetLabel}
                            <Input
                                value={
                                    selected.eventSelection.targetLabel ?? ""
                                }
                                onChange={(event) =>
                                    update({
                                        eventSelection: {
                                            ...selected.eventSelection,
                                            targetLabel:
                                                event.target.value.trim() ||
                                                undefined,
                                        },
                                    })
                                }
                            />
                        </label>
                        <label className="flex items-center gap-2 self-end pb-2 text-sm">
                            <input
                                type="checkbox"
                                checked={selected.eventSelection.targetOptional}
                                onChange={(event) =>
                                    update({
                                        eventSelection: {
                                            ...selected.eventSelection,
                                            targetOptional:
                                                event.target.checked,
                                        },
                                    })
                                }
                            />
                            {dictionary.targetIsOptional}
                        </label>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button onClick={() => void save()} disabled={saving}>
                            {saving ? dictionary.saving : dictionary.saveGame}
                        </Button>
                        {notice ? (
                            <span className="text-sm">{notice}</span>
                        ) : null}
                    </div>
                </section>
            ) : null}
        </div>
    )
}
