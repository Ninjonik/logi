"use client"

import {
    TEAM_SEARCH_MAX,
    type TeamGame,
    type TeamRecord,
} from "@/domain/teams/team"
import { fetchAdminTeamPage } from "@/lib/teams-admin/team-admin-client"
import { mergeCandidates } from "@/lib/teams-admin/team-admin-list"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { TeamLogo } from "@/components/app/team-logo"
import { useEffect, useId, useState } from "react"
import { Loader2, Search } from "lucide-react"
import { Input } from "@/components/ui/input"

const PICKER_LIMIT = 20

/**
 * Search-and-choose list of active catalogue teams of one game, rendered as a
 * native radio group so it is operable with the keyboard. The chosen team
 * stays listed while the search changes.
 */
export function TeamSearchPicker({
    gameId,
    excludeId,
    value,
    onChange,
    disabled,
    initialSearch = "",
    labels,
}: {
    gameId: TeamGame
    /** The team being merged away is never offered as its own target. */
    excludeId: string | null
    value: TeamRecord | null
    onChange(team: TeamRecord): void
    disabled: boolean
    initialSearch?: string
    labels: {
        legend: string
        search: string
        hint: string
        noResults: string
        loading: string
        error: string
    }
}) {
    const id = useId()
    const [search, setSearch] = useState(initialSearch)
    const term = useDebouncedValue(search.trim(), 300)
    const [results, setResults] = useState<TeamRecord[]>([])
    const [status, setStatus] = useState<"loading" | "ready" | "error">(
        "loading"
    )

    useEffect(() => {
        const controller = new AbortController()
        async function load() {
            setStatus("loading")
            try {
                const page = await fetchAdminTeamPage(
                    {
                        gameId,
                        archived: false,
                        search: term,
                        limit: PICKER_LIMIT,
                    },
                    { signal: controller.signal }
                )
                setResults(
                    mergeCandidates(page.items, {
                        id: excludeId ?? "",
                        gameId,
                    })
                )
                setStatus("ready")
            } catch {
                if (!controller.signal.aborted) setStatus("error")
            }
        }
        void load()
        return () => controller.abort()
    }, [gameId, excludeId, term])

    const listed =
        value && !results.some((team) => team.id === value.id)
            ? [value, ...results]
            : results

    return (
        <fieldset className="space-y-3" disabled={disabled}>
            <legend className="text-sm leading-none font-medium">
                {labels.legend}
            </legend>
            <div className="relative pt-1">
                <Search
                    className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 mt-0.5 size-4 -translate-y-1/2"
                    aria-hidden
                />
                <Input
                    type="search"
                    value={search}
                    maxLength={TEAM_SEARCH_MAX}
                    placeholder={labels.search}
                    aria-label={labels.search}
                    aria-describedby={`${id}-hint`}
                    className="pl-9"
                    onChange={(event) => setSearch(event.target.value)}
                    onKeyDown={(event) => {
                        // Enter searches; it must never submit the surrounding decision form.
                        if (event.key === "Enter") event.preventDefault()
                    }}
                />
            </div>
            <p id={`${id}-hint`} className="text-muted-foreground text-xs">
                {labels.hint}
            </p>
            <div aria-live="polite" className="min-h-0">
                {status === "loading" ? (
                    <p className="text-muted-foreground flex items-center gap-2 text-sm">
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                        {labels.loading}
                    </p>
                ) : status === "error" ? (
                    <p role="alert" className="text-destructive text-sm">
                        {labels.error}
                    </p>
                ) : listed.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                        {labels.noResults}
                    </p>
                ) : null}
            </div>
            {listed.length > 0 ? (
                <ul className="max-h-64 space-y-1 overflow-y-auto pr-1">
                    {listed.map((team) => {
                        const inputId = `${id}-${team.id}`
                        return (
                            <li key={team.id}>
                                <label
                                    htmlFor={inputId}
                                    className="hover:bg-accent has-[:checked]:border-primary has-[:focus-visible]:ring-ring/50 flex cursor-pointer items-center gap-3 rounded-md border p-2 has-[:focus-visible]:ring-[3px]"
                                >
                                    <input
                                        id={inputId}
                                        type="radio"
                                        name={`${id}-team`}
                                        value={team.id}
                                        checked={value?.id === team.id}
                                        onChange={() => onChange(team)}
                                        className="accent-primary size-4"
                                    />
                                    <TeamLogo
                                        name={team.name}
                                        shortCode={team.shortCode}
                                        logoUrl={team.logoUrl}
                                        className="size-8"
                                    />
                                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                                        {team.name}
                                    </span>
                                    {team.shortCode ? (
                                        <span className="text-muted-foreground text-xs">
                                            {team.shortCode}
                                        </span>
                                    ) : null}
                                </label>
                            </li>
                        )
                    })}
                </ul>
            ) : null}
        </fieldset>
    )
}
