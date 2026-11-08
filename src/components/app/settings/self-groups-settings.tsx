"use client"

import { getSelfGroupMessages } from "@/lib/clan-language/self-groups"
import { gameLabel, resolveGameScope } from "@/domain/games/game"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import type { Group } from "@/types/domain"
import { useState } from "react"
import { toast } from "sonner"

export function SelfGroupsSettings({
    serverId,
    groups,
    selected,
    locale,
}: {
    serverId: string
    groups: Group[]
    selected: string[]
    locale: string
}) {
    const copy = getSelfGroupMessages(locale)
    const router = useRouter()
    const [value, setValue] = useState(selected)
    const [saved, setSaved] = useState(selected)
    const [saving, setSaving] = useState(false)
    const changed =
        JSON.stringify([...value].sort()) !== JSON.stringify([...saved].sort())
    async function save() {
        setSaving(true)
        try {
            const response = await fetch(
                `/api/servers/${encodeURIComponent(serverId)}/discord-settings`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ selfAssignableGroupIds: value }),
                }
            )
            if (!response.ok) throw new Error(copy.settingsFailed)
            setSaved([...value])
            toast.success(copy.savedSettings)
            router.refresh()
        } catch {
            toast.error(copy.settingsFailed)
        } finally {
            setSaving(false)
        }
    }
    return (
        <section className="bg-card space-y-4 rounded-2xl border p-5">
            <h2 className="text-lg font-semibold">{copy.settingsTitle}</h2>
            <p className="text-muted-foreground text-sm">{copy.settingsHint}</p>
            {!groups.length ? (
                <p className="text-muted-foreground text-sm">{copy.noGroups}</p>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                    {groups.map((group) => (
                        <div key={group.id} className="flex items-center gap-2">
                            <Checkbox
                                id={`self-group-${group.id}`}
                                checked={value.includes(group.id)}
                                disabled={saving}
                                onCheckedChange={(checked) =>
                                    setValue((current) =>
                                        checked === true
                                            ? [
                                                  ...new Set([
                                                      ...current,
                                                      group.id,
                                                  ]),
                                              ]
                                            : current.filter(
                                                  (id) => id !== group.id
                                              )
                                    )
                                }
                            />
                            <Label htmlFor={`self-group-${group.id}`}>
                                {group.name}{" "}
                                <span className="text-muted-foreground text-xs">
                                    ({gameLabel(resolveGameScope(group.gameId))}
                                    )
                                </span>
                            </Label>
                        </div>
                    ))}
                </div>
            )}
            <Button onClick={save} disabled={saving || !changed}>
                {copy.save}
            </Button>
        </section>
    )
}
