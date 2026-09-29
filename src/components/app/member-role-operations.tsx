"use client"

import {
    memberRoleOperationsSchema,
    type MemberRoleOperations as OperationRecords,
} from "@/domain/membership/role-operations"
import type { Dictionary } from "@/i18n/dictionaries"
import { useEffect, useId, useState } from "react"
import { GAME_LABELS } from "@/domain/games/game"
import { Button } from "@/components/ui/button"

type Props = { serverId: string; dictionary: Dictionary }
export function MemberRoleOperations(props: Props) {
    return <Operations key={props.serverId} {...props} />
}
function Operations({ serverId, dictionary }: Props) {
    const t = dictionary.memberRoleOperations,
        heading = useId()
    const [data, setData] = useState<OperationRecords | null>(null)
    const [refresh, setRefresh] = useState(0),
        [loading, setLoading] = useState(true),
        [error, setError] = useState(false)
    useEffect(() => {
        const controller = new AbortController()
        void fetch(
            `/api/servers/${encodeURIComponent(serverId)}/member-role-operations`,
            { cache: "no-store", signal: controller.signal }
        )
            .then(async (response) => {
                if (!response.ok) throw new Error()
                const result = memberRoleOperationsSchema.parse(
                    await response.json()
                )
                if (!controller.signal.aborted) {
                    setData(result)
                    setError(false)
                }
            })
            .catch(() => {
                if (!controller.signal.aborted) {
                    setData(null)
                    setError(true)
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false)
            })
        return () => controller.abort()
    }, [serverId, refresh])
    return (
        <section
            aria-labelledby={heading}
            className="space-y-4 rounded-xl border p-4"
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 id={heading} className="font-semibold">
                    {t.title}
                </h3>
                <Button
                    variant="outline"
                    disabled={loading}
                    onClick={() => {
                        setLoading(true)
                        setRefresh((value) => value + 1)
                    }}
                >
                    {loading ? t.loading : t.refresh}
                </Button>
            </div>
            <p className="text-muted-foreground text-sm">{t.description}</p>
            {error && (
                <p role="alert" className="text-destructive text-sm">
                    {t.error}
                </p>
            )}
            {data?.length === 0 && (
                <p role="status" className="text-sm">
                    {t.empty}
                </p>
            )}
            <div aria-busy={loading} className="space-y-3">
                {data?.map((operation) => (
                    <article
                        key={operation.id}
                        className="space-y-3 rounded-lg border p-3 text-sm"
                    >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium">
                                {GAME_LABELS[operation.gameId]}
                            </span>
                            <span
                                className={`rounded-full border px-2 py-1 ${["failed", "denied"].includes(operation.status) ? "text-destructive" : ""}`}
                            >
                                {t.status[operation.status]}
                            </span>
                        </div>
                        <dl className="grid gap-2 sm:grid-cols-2">
                            <div>
                                <dt className="text-muted-foreground">
                                    {/^\d{17,20}$/.test(operation.userId)
                                        ? t.target
                                        : t.unlinkedTarget}
                                </dt>
                                <dd className="font-mono break-all">
                                    {operation.userId}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground">
                                    {t.actor}
                                </dt>
                                <dd className="font-mono break-all">
                                    {operation.actorId}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground">
                                    {t.origin}
                                </dt>
                                <dd>
                                    {t.provenance[operation.provenance]} ·{" "}
                                    {t.version} {operation.version}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground">
                                    {t.updated}
                                </dt>
                                <dd>
                                    <time dateTime={operation.updatedAt}>
                                        {operation.updatedAt
                                            .replace("T", " ")
                                            .replace(/\.\d{3}Z$/, " UTC")}
                                    </time>
                                </dd>
                            </div>
                        </dl>
                        <p>{t.hint[operation.status]}</p>
                        <details className="rounded border p-2">
                            <summary className="cursor-pointer">
                                {t.audit} ({operation.attempts})
                            </summary>
                            <p className="text-muted-foreground my-2">
                                {t.auditDescription}
                            </p>
                            <ul className="space-y-2">
                                {operation.audit.map((entry) => (
                                    <li
                                        key={entry.attempt}
                                        className="flex flex-wrap gap-x-3 gap-y-1 border-t pt-2"
                                    >
                                        <span>
                                            #{entry.attempt} ·{" "}
                                            {t.status[entry.outcome]}
                                        </span>
                                        <time dateTime={entry.at}>
                                            {entry.at
                                                .replace("T", " ")
                                                .replace(/\.\d{3}Z$/, " UTC")}
                                        </time>
                                        <code className="break-all">
                                            {entry.reason}
                                        </code>
                                    </li>
                                ))}
                            </ul>
                            <p className="mt-2 break-all">
                                <span>{t.reason}: </span>
                                <code>{operation.reason}</code>
                            </p>
                        </details>
                    </article>
                ))}
            </div>
        </section>
    )
}
