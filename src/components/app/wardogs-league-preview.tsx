"use client"
import {
    leagueReadSchema,
    CACHE_MS,
    type LeagueRead,
} from "@/domain/wardogs-league/contracts"
import { useLocale, useTranslations } from "next-intl"
import { useEffect, useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

export function WardogsLeaguePreview({ serverId }: { serverId: string }) {
    const t = useTranslations("leagueMatch"),
        locale = useLocale(),
        id = useId()
    const [url, setUrl] = useState("")
    const [data, setData] = useState<LeagueRead | null>(null)
    const [now, setNow] = useState(Date.now)
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 30_000)
        return () => clearInterval(timer)
    }, [])
    const [loading, setLoading] = useState(false),
        [error, setError] = useState(false)
    const timestamp = (value: string | null | undefined) =>
        value
            ? new Intl.DateTimeFormat(locale, {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "Europe/Prague",
              }).format(new Date(value))
            : t("unknown")
    const match = data?.snapshot
    const ageSeconds = match
        ? Math.max(0, Math.floor((now - Date.parse(match.fetchedAt)) / 1000))
        : null
    const stale =
        data?.stale || (ageSeconds !== null && ageSeconds * 1000 >= CACHE_MS)
    return (
        <section
            className="mt-6 space-y-4 border-t pt-6"
            aria-labelledby={`${id}-title`}
        >
            <div>
                <h3 id={`${id}-title`} className="text-base font-semibold">
                    {t("title")}
                </h3>
                <p className="text-muted-foreground mt-1 text-sm">
                    {t("description")}
                </p>
            </div>
            <form
                className="space-y-2"
                onSubmit={async (event) => {
                    event.preventDefault()
                    setLoading(true)
                    setError(false)
                    setData(null)
                    try {
                        const response = await fetch(
                            `/api/servers/${encodeURIComponent(serverId)}/league-matches?${new URLSearchParams({ game: "wardogs", url: url.trim() })}`,
                            { cache: "no-store" }
                        )
                        const body: unknown = await response.json()
                        const parsed = leagueReadSchema.safeParse(
                            body && typeof body === "object" && "data" in body
                                ? body.data
                                : null
                        )
                        if (!parsed.success) throw new Error()
                        setData(parsed.data)
                        setNow(Date.now())
                    } catch {
                        setError(true)
                    } finally {
                        setLoading(false)
                    }
                }}
            >
                <Label htmlFor={id}>{t("url")}</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                        id={id}
                        type="url"
                        required
                        maxLength={250}
                        value={url}
                        disabled={loading}
                        onChange={(event) => setUrl(event.target.value)}
                        placeholder="https://wardogsleague.net/matches/…"
                        className="flex-1"
                    />
                    <Button type="submit" disabled={loading || !url.trim()}>
                        {loading ? t("loading") : t("load")}
                    </Button>
                </div>
            </form>
            <div aria-live="polite" aria-busy={loading} className="space-y-4">
                {error && (
                    <p role="alert" className="text-destructive">
                        {t("error")}
                    </p>
                )}
                {data && !match && (
                    <p role="alert">
                        {t("unavailable")} {t("nextCheck")}:{" "}
                        {timestamp(data.nextRefreshAt)}.
                    </p>
                )}
                {match && data && (
                    <>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h4 className="text-lg font-semibold">
                                    {match.title}
                                </h4>
                                <p className="text-muted-foreground">
                                    #{match.fixtureNumber ?? "—"} ·{" "}
                                    {match.type ?? t("unknown")} ·{" "}
                                    {match.status ?? t("unknown")}
                                </p>
                            </div>
                            <a
                                href={match.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary underline"
                            >
                                {t("source")}
                            </a>
                        </div>
                        {stale && (
                            <p
                                role="status"
                                className="rounded-md border border-amber-500 p-3"
                            >
                                {t("stale")} {t("fetched")}:{" "}
                                {timestamp(match.fetchedAt)}. {t("nextCheck")}:{" "}
                                {timestamp(data.nextRefreshAt)}.
                            </p>
                        )}
                        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                            {[
                                [t("scheduled"), timestamp(match.scheduledAt)],
                                [t("map"), match.map?.name],
                                [t("zone"), match.map?.zone],
                                [t("lighting"), match.map?.lighting],
                                [
                                    t("hosting"),
                                    match.hosting
                                        ? [
                                              match.hosting.mode,
                                              match.hosting.teamCode,
                                          ]
                                              .filter(Boolean)
                                              .join(" · ")
                                        : null,
                                ],
                                [t("moderator"), match.moderator],
                                [t("ready"), match.readyCheck],
                                [t("points"), match.scoringRule],
                            ].map(([label, value]) => (
                                <div key={label}>
                                    <dt className="text-muted-foreground text-xs">
                                        {label}
                                    </dt>
                                    <dd className="mt-1 text-sm font-medium">
                                        {value || t("unknown")}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                        {match.teams ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <caption className="text-muted-foreground mb-2 text-left text-xs">
                                        {t("membersNote")}
                                    </caption>
                                    <thead>
                                        <tr>
                                            {[
                                                t("team"),
                                                t("faction"),
                                                t("nations"),
                                                t("members"),
                                            ].map((label) => (
                                                <th
                                                    key={label}
                                                    className="border-b p-2"
                                                >
                                                    {label}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {match.teams.map((team) => (
                                            <tr key={team.code}>
                                                <td className="border-b p-2">
                                                    <a
                                                        href={team.profileUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="underline"
                                                    >
                                                        {team.code} ·{" "}
                                                        {team.name ??
                                                            t("unknown")}
                                                    </a>
                                                </td>
                                                <td className="border-b p-2">
                                                    {team.faction ??
                                                        t("unknown")}
                                                </td>
                                                <td className="border-b p-2">
                                                    {team.nations?.join(", ") ??
                                                        t("unknown")}
                                                </td>
                                                <td className="border-b p-2">
                                                    {team.displayedMemberCount ??
                                                        t("unknown")}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p>{t("teamsUnavailable")}</p>
                        )}
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <h5 className="font-medium">{t("vote")}</h5>
                                <p className="text-sm">
                                    {match.mapVote?.status ?? t("unknown")} ·{" "}
                                    {t("closes")}:{" "}
                                    {timestamp(match.mapVote?.closesAt)}
                                </p>
                                <ul className="mt-2 text-sm">
                                    {match.mapVote?.ballots?.map((ballot) => (
                                        <li key={ballot.teamCode}>
                                            {ballot.teamCode}:{" "}
                                            {ballot.value ?? t("unknown")}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div>
                                <h5 className="font-medium">{t("rules")}</h5>
                                <p className="text-sm">
                                    {match.rules?.summary ?? t("unknown")}
                                </p>
                                <ul className="mt-2 text-sm">
                                    {match.rules?.choices?.map((choice) => (
                                        <li key={choice.teamCode}>
                                            {choice.teamCode}:{" "}
                                            {choice.value ?? t("unknown")}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                        <details>
                            <summary className="cursor-pointer font-medium">
                                {t("progress")}
                            </summary>
                            <ol className="mt-2 space-y-1 text-sm">
                                {match.progress?.map((step) => (
                                    <li key={step.label}>
                                        {step.label} ·{" "}
                                        {step.state
                                            ? t(step.state)
                                            : t("unknown")}
                                        {step.detail ? ` · ${step.detail}` : ""}
                                    </li>
                                )) ?? <li>{t("unknown")}</li>}
                            </ol>
                        </details>
                        <div className="text-muted-foreground space-y-1 text-xs">
                            <p>{t("resultsNote")}</p>
                            {match.warnings.some(
                                (w) => w !== "results_not_supported"
                            ) && <p>{t("partial")}</p>}
                            <p>
                                {t("fetched")}: {timestamp(match.fetchedAt)} ·{" "}
                                {ageSeconds === null
                                    ? t("unknown")
                                    : t("age", { seconds: ageSeconds })}{" "}
                                · {t("timezone")}
                            </p>
                        </div>
                    </>
                )}
            </div>
        </section>
    )
}
