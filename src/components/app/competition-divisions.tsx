"use client"

import type { CompetitionSectionProps } from "@/components/app/competition-manager"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from "lucide-react"
import { DIVISION_NAME_MAX } from "@/domain/competitions/competition"
import { useId, useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

/** Create, rename, reorder and delete (when empty) a competition's divisions. */
export function CompetitionDivisions({
    view,
    dictionary,
    run,
    pending,
}: CompetitionSectionProps) {
    const t = dictionary.competitionAdmin
    const id = useId()
    const [name, setName] = useState("")
    const [names, setNames] = useState<Record<string, string>>({})
    const divisions = view.divisions

    async function add(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!name.trim()) return
        const result = await run({
            action: "createDivision",
            competitionId: view.competition.id,
            input: { name },
        })
        if (result.ok) setName("")
    }

    async function move(index: number, offset: -1 | 1) {
        const order = divisions.map((division) => division.id)
        const target = index + offset
        ;[order[index], order[target]] = [order[target], order[index]]
        await run({
            action: "reorderDivisions",
            competitionId: view.competition.id,
            input: { divisionIds: order },
        })
    }

    async function rename(divisionId: string) {
        const next = names[divisionId]
        if (next === undefined) return
        const result = await run(
            { action: "renameDivision", divisionId, input: { name: next } },
            t.saved
        )
        if (result.ok)
            setNames(({ [divisionId]: _done, ...rest }) => {
                void _done
                return rest
            })
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t.divisionsTitle}</CardTitle>
                <p className="text-muted-foreground text-sm">
                    {t.divisionsDescription}
                </p>
            </CardHeader>
            <CardContent className="space-y-4">
                {divisions.length ? (
                    <ol className="space-y-2">
                        {divisions.map((division, index) => {
                            const draft = names[division.id]
                            const teams = view.registrations.filter(
                                (row) => row.divisionId === division.id
                            ).length
                            const fixtures = view.fixtures.filter(
                                (row) => row.divisionId === division.id
                            ).length
                            return (
                                <li
                                    key={division.id}
                                    className="flex flex-wrap items-center gap-2 rounded-xl border p-2"
                                >
                                    <Input
                                        aria-label={`${t.divisionName}: ${division.name}`}
                                        value={draft ?? division.name}
                                        maxLength={DIVISION_NAME_MAX}
                                        disabled={pending}
                                        className="h-9 min-w-40 flex-1"
                                        onChange={(event) =>
                                            setNames((current) => ({
                                                ...current,
                                                [division.id]:
                                                    event.target.value,
                                            }))
                                        }
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter") {
                                                event.preventDefault()
                                                void rename(division.id)
                                            }
                                        }}
                                    />
                                    <span className="text-muted-foreground text-xs">
                                        {t.divisionCounts
                                            .replace("{teams}", String(teams))
                                            .replace(
                                                "{fixtures}",
                                                String(fixtures)
                                            )}
                                    </span>
                                    {draft !== undefined &&
                                    draft !== division.name ? (
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            disabled={pending}
                                            onClick={() =>
                                                void rename(division.id)
                                            }
                                        >
                                            <Check
                                                className="size-4"
                                                aria-hidden
                                            />
                                            {t.rename}
                                        </Button>
                                    ) : null}
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        aria-label={`${t.moveUp}: ${division.name}`}
                                        disabled={pending || index === 0}
                                        onClick={() => void move(index, -1)}
                                    >
                                        <ArrowUp className="size-4" />
                                    </Button>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        aria-label={`${t.moveDown}: ${division.name}`}
                                        disabled={
                                            pending ||
                                            index === divisions.length - 1
                                        }
                                        onClick={() => void move(index, 1)}
                                    >
                                        <ArrowDown className="size-4" />
                                    </Button>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        aria-label={`${t.delete}: ${division.name}`}
                                        disabled={
                                            pending || teams > 0 || fixtures > 0
                                        }
                                        onClick={() => {
                                            if (
                                                window.confirm(
                                                    t.confirmDeleteDivision.replace(
                                                        "{name}",
                                                        division.name
                                                    )
                                                )
                                            )
                                                void run({
                                                    action: "deleteDivision",
                                                    divisionId: division.id,
                                                })
                                        }}
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                </li>
                            )
                        })}
                    </ol>
                ) : (
                    <p className="text-muted-foreground text-sm">
                        {t.noDivisions}
                    </p>
                )}
                <form
                    onSubmit={add}
                    className="flex flex-wrap items-end gap-2"
                    noValidate
                >
                    <div className="min-w-48 flex-1 space-y-2">
                        <Label htmlFor={`${id}-new`}>{t.divisionName}</Label>
                        <Input
                            id={`${id}-new`}
                            value={name}
                            maxLength={DIVISION_NAME_MAX}
                            disabled={pending}
                            onChange={(event) => setName(event.target.value)}
                        />
                    </div>
                    <Button type="submit" disabled={pending || !name.trim()}>
                        <Plus className="size-4" aria-hidden />
                        {t.addDivision}
                    </Button>
                </form>
            </CardContent>
        </Card>
    )
}
