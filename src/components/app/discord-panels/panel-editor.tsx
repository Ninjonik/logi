"use client"

import { ChevronLeft, Pause, Play, RefreshCw, Send, Trash2 } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useLocale } from "next-intl"
import { toast } from "sonner"
import Link from "next/link"

import {
    draftChanges,
    draftFromSettings,
    draftProblems,
    draftToSettings,
    freeResultsGame,
    newPanelDraft,
    resultsGamesTaken,
    serverJoinDraft,
    serverJoinPatch,
    serverJoinProblems,
    takenPanelKinds,
    type PanelEditorDraft,
    type ServerJoinDraft,
} from "@/domain/discord-publications/panel-editor"
import {
    calendarPanelView,
    calendarPanelEntries,
    type CalendarEntry,
} from "@/domain/discord-publications/calendar-panel"
import {
    resultCardView,
    type ResultCardEvent,
} from "@/domain/discord-publications/result-panel"
import {
    serverJoinSlugBase,
    serverJoinUrl,
} from "@/domain/discord-publications/server-join"
import { saveDiscordSettings } from "@/components/app/settings/save-discord-settings"
import { unsavedChangesLabel } from "@/components/app/settings/unsaved-changes-bar"
import { panelImageCopy } from "@/domain/discord-publications/panel-image-copy"
import type { PanelStyle } from "@/domain/discord-publications/panel-graphics"
import type { MessageStyle } from "@/domain/discord-messages/message-style"
import type { MessageView } from "@/domain/discord-messages/message-view"
import { factionEmblem } from "@/domain/discord-messages/faction-emblem"
import type { PanelKind } from "@/domain/discord-publications/settings"
import type { GameServerSource } from "@/domain/game-data/credentials"
import type { LeagueOverview } from "@/domain/wardogs-league/panels"
import { useDiscordMetadata } from "@/hooks/use-discord-metadata"
import { getPanelMessages } from "@/lib/clan-language/panels"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import {
    CalendarStep,
    ChannelStep,
    CompetitionStep,
    GameStep,
    LeagueContentStep,
    ResultsContentStep,
    LookStep,
    RefreshStep,
    ServerContentStep,
    ServerStep,
    ServersContentStep,
    ServersStep,
    TypeStep,
    type ChannelCheckState,
    type EditorContext,
} from "./editor-steps"
import {
    checkPanelChannel,
    readConnectionRefs,
    readGameServerSources,
    readLeaguePreview,
    renderPreviewImage,
    requestPanelAction,
    savePanelSettings,
    saveServerJoin,
    testPanelFetch,
} from "./panels-api"
import {
    combinedPreview,
    leaguePreviews,
    liveServerPreview,
    previewBannerModel,
    previewScoreModel,
    type EditorPreviewInput,
    type PreviewServer,
} from "./editor-preview"
import {
    DeliveryCard,
    JoinPageMock,
    OpenInDiscord,
    PreviewCard,
    ServerDataCard,
    SourceCard,
    type ServerTestState,
} from "./editor-side"
import { usePanelOverview, useNow } from "./use-panel-overview"
import { clockTime, timeAgo, timeIn } from "./panel-time"
import { GameChip, StateChip } from "./panel-chips"
import { channelLabel, fill } from "./panel-copy"
import { sourceLive } from "./data-sources-card"
import { discordMessageUrl } from "./panel-rows"

export type PanelEditorProps = {
    serverId: string
    guildId: string
    /** Null: a new panel. */
    panelId: string | null
    initialKind: PanelKind | null
    siteUrl: string
    clan: {
        name: string
        /** The banner badge from "Grafika panelů" (P8-07). */
        tag: string
        language: string
        timeZone: string
        messageStyle: MessageStyle | null
        accentHex: string
    }
    defaultStyle: PanelStyle
    enabledGames: readonly string[]
    ticketCategories: ReadonlyArray<{ id: string; label: string }>
    eventCategories: ReadonlyArray<{ id: string; label: string }>
    competitions: ReadonlyArray<{ id: string; name: string; gameId: string }>
    calendarEntries: readonly CalendarEntry[]
    /**
     * The calendar channel saved before panels existed (N1-47). A new
     * calendar panel starts in it and takes its message over on save.
     */
    calendarSettingChannelId: string | null
    resultEvents: Partial<
        Record<
            "hell_let_loose" | "wardogs",
            ResultCardEvent & { mapLabel: string | null }
        >
    >
    hrefs: {
        panels: string
        gameServers: string
        tickets: string
        seed: string
        graphics: string
        calendar: string | null
    }
    dictionary: Dictionary
}

type SeedInfo = { running: { liveFrom: number } | null; liveFrom: number }

/**
 * The panel editor (board P2): steps 1–6 on the left, on the right the
 * rendered preview from real server data, the join page, "Data ze serveru",
 * the source and the delivery timeline, and the sticky bar with Uložit,
 * Odeslat do kanálu, Obnovit teď, Pozastavit and Odstranit zprávu.
 */
export function PanelEditor(props: PanelEditorProps) {
    const { serverId, panelId, dictionary } = props
    const locale = useLocale()
    const now = useNow()
    const router = useRouter()
    const metadata = useDiscordMetadata(serverId)
    const { overview, status, refresh } = usePanelOverview(serverId)
    const text = dictionary.discordPanelsPage
    const editor = text.editor
    const item = panelId
        ? (overview?.panels.find((panel) => panel.id === panelId) ?? null)
        : null

    // ---- Draft ----------------------------------------------------------------------
    const [loaded, setLoaded] = useState<{
        saved: PanelEditorDraft
        draft: PanelEditorDraft
        revision: number | null
    } | null>(() => {
        if (panelId) return null
        const kind = props.initialKind ?? "server"
        const fresh = newPanelDraft({ kind })
        return {
            saved: fresh,
            draft:
                kind === "calendar" && props.calendarSettingChannelId
                    ? { ...fresh, channelId: props.calendarSettingChannelId }
                    : fresh,
            revision: null,
        }
    })
    if (panelId && item && !loaded) {
        const draft = draftFromSettings(item.settings)
        setLoaded({ saved: draft, draft, revision: item.revision })
    }
    const draft = loaded?.draft ?? null
    const update = (patch: Partial<PanelEditorDraft>) =>
        setLoaded((current) =>
            current
                ? { ...current, draft: { ...current.draft, ...patch } }
                : current
        )

    // A new panel picks the first server once the sources are known.
    if (
        draft &&
        !panelId &&
        overview?.sources.length &&
        draft.kind === "server" &&
        !draft.connectionId &&
        !loaded?.saved.connectionId
    ) {
        const first = overview.sources[0]!.connectionId
        setLoaded((current) =>
            current
                ? {
                      ...current,
                      draft: { ...current.draft, connectionId: first },
                      saved: { ...current.saved, connectionId: first },
                  }
                : current
        )
    }
    // A new results panel ("?type=results") moves to a game without results
    // once the clan's panels are known: one results panel per game (P2-04).
    if (draft && !panelId && overview && draft.kind === "results") {
        const gameId = freeResultsGame({
            current: draft.gameId,
            taken: resultsGamesTaken(overview.panels, null),
            enabledGames: props.enabledGames,
        })
        if (gameId !== draft.gameId)
            setLoaded((current) =>
                current
                    ? {
                          ...current,
                          draft: { ...current.draft, gameId },
                          saved: { ...current.saved, gameId },
                      }
                    : current
            )
    }

    // ---- Join details per server -------------------------------------------------
    const servers = useMemo(
        () =>
            Object.fromEntries(
                (overview?.servers ?? []).map((server) => [
                    server.connectionId,
                    server,
                ])
            ),
        [overview]
    )
    const [joinEdits, setJoinEdits] = useState<Record<string, ServerJoinDraft>>(
        {}
    )
    const joinOf = (connectionId: string) =>
        joinEdits[connectionId] ??
        serverJoinDraft(servers[connectionId] ?? null)
    const relevant = draft
        ? draft.kind === "server"
            ? draft.connectionId
                ? [draft.connectionId]
                : []
            : draft.kind === "servers"
              ? draft.connectionIds
              : []
        : []
    const joins = Object.fromEntries(relevant.map((id) => [id, joinOf(id)]))
    const setJoin = (connectionId: string, patch: Partial<ServerJoinDraft>) =>
        setJoinEdits((current) => ({
            ...current,
            [connectionId]: {
                ...(current[connectionId] ??
                    serverJoinDraft(servers[connectionId] ?? null)),
                ...patch,
            },
        }))
    const joinPatches = relevant.flatMap((id) => {
        const patch = serverJoinPatch(joinOf(id), servers[id] ?? null)
        return patch ? [[id, patch] as const] : []
    })
    const joinProblems = relevant.some(
        (id) => serverJoinProblems(joinOf(id)).length > 0
    )

    // ---- Channel check ----------------------------------------------------------
    const [check, setCheck] = useState<{
        channelId: string
        state: ChannelCheckState
    } | null>(null)
    const channelCheck: ChannelCheckState =
        draft && check?.channelId === draft.channelId
            ? check.state
            : { status: "idle" }
    async function verifyChannel(channelId = draft?.channelId) {
        if (!channelId) return
        setCheck({ channelId, state: { status: "loading" } })
        const result = await checkPanelChannel(serverId, channelId).catch(
            () => null
        )
        setCheck((current) =>
            current?.channelId === channelId
                ? {
                      channelId,
                      state: result
                          ? { status: "done", result }
                          : { status: "failed" },
                  }
                : current
        )
    }
    const channelPrivate =
        channelCheck.status === "done"
            ? !channelCheck.result.everyoneCanView
            : item && draft && item.channelId === draft.channelId
              ? item.channelPrivate
              : null
    // Attach Files in the chosen channel: the check, else what the bot last
    // saw there. Without it the bot posts text only, and so does the
    // preview (P2-B02, P2-B09).
    const canAttach =
        channelCheck.status === "done"
            ? channelCheck.result.permissions.attach_files
            : !(
                  item &&
                  draft &&
                  item.channelId === draft.channelId &&
                  item.warnings.includes("attach_files_missing")
              )
    // Check the channel once it is chosen or loaded (P2-09).
    const checkedFor = useRef<string | null>(null)
    useEffect(() => {
        const channelId = draft?.channelId
        if (!channelId || checkedFor.current === channelId) return
        checkedFor.current = channelId
        void verifyChannel(channelId)
        // verifyChannel reads only the channel ID passed in.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draft?.channelId])

    // ---- Server data (test read) and seeds ------------------------------------
    const [tests, setTests] = useState<Record<string, ServerTestState>>({})
    const [seeds, setSeeds] = useState<Record<string, SeedInfo>>({})
    const requested = useRef(new Set<string>())
    async function loadData(ids: readonly string[]) {
        setTests((current) => ({
            ...current,
            ...Object.fromEntries(
                ids.map((id) => [id, { status: "loading" } as const])
            ),
        }))
        await Promise.all(
            ids.map(async (connectionId) => {
                const [result, seed] = await Promise.all([
                    testPanelFetch(serverId, { connectionId, panelId }).catch(
                        () => null
                    ),
                    fetch(
                        `/api/servers/${encodeURIComponent(serverId)}/discord-seed?server=${encodeURIComponent(connectionId)}`,
                        { cache: "no-store" }
                    )
                        .then((response) =>
                            response.ok ? response.json() : null
                        )
                        .catch(() => null),
                ])
                setTests((current) => ({
                    ...current,
                    [connectionId]: result
                        ? { status: "done", result }
                        : { status: "failed" },
                }))
                const selected = (
                    seed as {
                        selected?: {
                            settings?: { liveFrom?: number }
                            activeRun?: {
                                progress?: { liveFrom?: number }
                            } | null
                        } | null
                    } | null
                )?.selected
                const liveFrom = selected?.settings?.liveFrom ?? 40
                setSeeds((current) => ({
                    ...current,
                    [connectionId]: {
                        liveFrom,
                        running: selected?.activeRun
                            ? {
                                  liveFrom:
                                      selected.activeRun.progress?.liveFrom ??
                                      liveFrom,
                              }
                            : null,
                    },
                }))
            })
        )
    }
    const relevantKey = relevant.join(",")
    useEffect(() => {
        const fresh = relevantKey
            .split(",")
            .filter((id) => id && !requested.current.has(id))
        if (!fresh.length) return
        fresh.forEach((id) => requested.current.add(id))
        void loadData(fresh)
        // loadData only reads the IDs passed in.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [relevantKey])

    // ---- Herní servery detail (key, address) -------------------------------------
    const [sourceDetails, setSourceDetails] = useState<
        Record<string, GameServerSource>
    >({})
    useEffect(() => {
        let active = true
        void Promise.all([
            readGameServerSources(serverId),
            readConnectionRefs(serverId),
        ]).then(([list, refs]) => {
            if (!active || !list || !refs) return
            setSourceDetails(
                Object.fromEntries(
                    Object.entries(refs).flatMap(([connectionId, ref]) => {
                        const source = list.sources.find(
                            (entry) => entry.ref === ref
                        )
                        return source ? [[connectionId, source]] : []
                    })
                )
            )
        })
        return () => {
            active = false
        }
    }, [serverId])

    // ---- League data ---------------------------------------------------------------
    const [league, setLeague] = useState<
        | { status: "idle" | "loading" | "failed" }
        | { status: "done"; data: LeagueOverview }
    >({ status: "idle" })
    const wantsLeague = draft?.kind === "league"
    useEffect(() => {
        if (!wantsLeague) return
        let active = true
        void readLeaguePreview(serverId, 10).then((data) => {
            if (active)
                setLeague(
                    data ? { status: "done", data } : { status: "failed" }
                )
        })
        return () => {
            active = false
        }
    }, [serverId, wantsLeague])

    // ---- Preview -------------------------------------------------------------------
    const nameOf = (connectionId: string) =>
        overview?.sources.find((source) => source.connectionId === connectionId)
            ?.name ?? null
    const predictedJoinUrl = (connectionId: string) => {
        const saved = servers[connectionId]
        if (saved?.joinUrl) return saved.joinUrl
        const name = nameOf(connectionId)
        return name
            ? serverJoinUrl(props.siteUrl, serverJoinSlugBase(name))
            : null
    }
    const previewServers: Record<string, PreviewServer> = Object.fromEntries(
        relevant.map((connectionId) => {
            const join = joinOf(connectionId)
            const saved = servers[connectionId]
            return [
                connectionId,
                {
                    connectionId,
                    name: nameOf(connectionId),
                    gameId:
                        overview?.sources.find(
                            (source) => source.connectionId === connectionId
                        )?.gameId ?? "hell_let_loose",
                    joinUrl: predictedJoinUrl(connectionId),
                    // As edited: a removed address or code leaves the preview too.
                    address: join.address.trim() || null,
                    joinCode: join.joinCode.trim() || null,
                    hasPassword:
                        Boolean(join.password) ||
                        (Boolean(saved?.hasPassword) && !join.clearPassword),
                },
            ]
        })
    )
    const facts = Object.fromEntries(
        relevant.map((id) => {
            const state = tests[id]
            return [id, state?.status === "done" ? state.result.facts : null]
        })
    )
    const [images, setImages] = useState<{
        score: { key: string; url: string | null } | null
        banner: { key: string; url: string | null } | null
    }>({ score: null, banner: null })
    const previewInput: EditorPreviewInput | null = draft
        ? {
              draft,
              panelId,
              revision: loaded?.revision ?? 0,
              language: props.clan.language,
              timeZone: props.clan.timeZone,
              clanName: props.clan.name,
              clanTag: props.clan.tag,
              defaultStyle: props.defaultStyle,
              now,
              channelPrivate,
              servers: previewServers,
              facts,
              seeds: Object.fromEntries(
                  relevant.map((id) => [id, seeds[id]?.running ?? null])
              ),
              liveFrom: Object.fromEntries(
                  relevant.map((id) => [id, seeds[id]?.liveFrom ?? 40])
              ),
              images: {
                  score: images.score?.url ?? null,
                  banner: images.banner?.url ?? null,
              },
              assetOrigin:
                  typeof window === "undefined"
                      ? props.siteUrl
                      : window.location.origin,
              canAttach,
              emoji: overview?.emoji ?? {},
          }
        : null
    const scoreModel = previewInput
        ? previewScoreModel(previewInput, props.clan.accentHex)
        : null
    const bannerModel = previewInput
        ? previewBannerModel(previewInput, props.clan.accentHex)
        : null
    const scoreKey = scoreModel
        ? JSON.stringify({ ...scoreModel, renderedAt: null })
        : null
    const bannerKey = bannerModel ? JSON.stringify(bannerModel) : null
    useEffect(() => {
        if (!scoreModel || !scoreKey || images.score?.key === scoreKey) return
        let active = true
        const timer = setTimeout(() => {
            void renderPreviewImage(serverId, {
                kind: "score",
                model: scoreModel,
            }).then((url) => {
                if (!active) {
                    if (url) URL.revokeObjectURL(url)
                    return
                }
                setImages((current) => {
                    if (current.score?.url)
                        URL.revokeObjectURL(current.score.url)
                    return { ...current, score: { key: scoreKey, url } }
                })
            })
        }, 500)
        return () => {
            active = false
            clearTimeout(timer)
        }
        // The key stands for the model.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scoreKey, serverId])
    useEffect(() => {
        if (!bannerModel || !bannerKey || images.banner?.key === bannerKey)
            return
        let active = true
        const timer = setTimeout(() => {
            void renderPreviewImage(serverId, {
                kind: "banner",
                model: bannerModel,
            }).then((url) => {
                if (!active) {
                    if (url) URL.revokeObjectURL(url)
                    return
                }
                setImages((current) => {
                    if (current.banner?.url)
                        URL.revokeObjectURL(current.banner.url)
                    return { ...current, banner: { key: bannerKey, url } }
                })
            })
        }, 500)
        return () => {
            active = false
            clearTimeout(timer)
        }
        // The key stands for the model.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bannerKey, serverId])
    // A score image that no longer matches the model is not shown.
    if (previewInput && images.score && images.score.key !== scoreKey)
        previewInput.images.score = null
    if (previewInput && images.banner && images.banner.key !== bannerKey)
        previewInput.images.banner = null

    const channelName = draft?.channelId
        ? channelLabel(
              draft.channelId,
              metadata?.channels ?? null,
              text.list.meta.unknownChannel
          )
        : null
    const previewViews: MessageView[] = []
    let previewPlaceholder: string | null = null
    let previewNote: string | null = null
    let previewTitle = fill(editor.preview.titlePlain, {
        channel: channelName ?? editor.preview.noChannel,
    })
    if (draft && previewInput) {
        const copy = getPanelMessages(props.clan.language)
        const accentColor =
            draft.accent === "custom" &&
            /^#[0-9a-fA-F]{6}$/.test(draft.accentColor)
                ? draft.accentColor.toLowerCase()
                : null
        switch (draft.kind) {
            case "server": {
                const view = liveServerPreview(previewInput)
                if (view) previewViews.push(view)
                const state = draft.connectionId
                    ? tests[draft.connectionId]
                    : undefined
                previewPlaceholder = !draft.connectionId
                    ? editor.preview.noServer
                    : state?.status === "loading" || !state
                      ? editor.preview.loading
                      : editor.preview.pending
                previewTitle = fill(editor.preview.title, {
                    channel: channelName ?? editor.preview.noChannel,
                    server:
                        (nameOf(draft.connectionId) ?? "").split(" · ")[0] ||
                        "—",
                })
                break
            }
            case "servers": {
                const view = combinedPreview(previewInput)
                if (view) previewViews.push(view)
                previewPlaceholder = draft.connectionIds.length
                    ? editor.preview.loading
                    : editor.preview.noServer
                previewTitle = fill(editor.preview.titleCombined, {
                    channel: channelName ?? editor.preview.noChannel,
                    count: draft.connectionIds.length,
                })
                break
            }
            case "league":
                previewTitle = fill(editor.preview.titleLeague, {
                    channel: channelName ?? editor.preview.noChannel,
                })
                if (league.status === "done")
                    previewViews.push(
                        ...leaguePreviews({
                            standings: league.data.standings,
                            fixtures: league.data.fixtures,
                            options: draft.league,
                            language: props.clan.language,
                            timeZone: props.clan.timeZone,
                            style: props.clan.messageStyle,
                            accentColor,
                            paused: Boolean(item?.paused),
                            artwork:
                                draft.artwork &&
                                draft.layout.showMap &&
                                canAttach,
                            assetOrigin: previewInput.assetOrigin,
                            now,
                            emoji: previewInput.emoji,
                        })
                    )
                previewPlaceholder =
                    league.status === "failed"
                        ? editor.preview.leagueFailed
                        : editor.preview.leagueLoading
                break
            case "calendar":
                previewViews.push(
                    calendarPanelView({
                        copy: copy.calendarPanel,
                        locale: panelImageCopy(props.clan.language).locale,
                        timeZone: props.clan.timeZone,
                        clanName: props.clan.name,
                        entries: calendarPanelEntries(props.calendarEntries, {
                            now,
                            categories: draft.calendarCategories,
                        }),
                        now,
                        calendarUrl: props.hrefs.calendar,
                        updatedAt: now,
                        accentColor,
                        title: draft.title.trim() || null,
                    })
                )
                previewNote = editor.preview.calendarNote
                break
            case "results": {
                const event = props.resultEvents[draft.gameId]
                if (event)
                    previewViews.push(
                        resultCardView({
                            copy: copy.results,
                            game: draft.gameId,
                            gameName: copy.live.game[draft.gameId],
                            locale: panelImageCopy(props.clan.language).locale,
                            timeZone: props.clan.timeZone,
                            event,
                            mapLabel: event.mapLabel,
                            sideName: (label) =>
                                label.trim().toLowerCase() === "allies"
                                    ? copy.live.allies
                                    : label.trim().toLowerCase() === "axis"
                                      ? copy.live.axis
                                      : label,
                            sideSign: (label) => factionEmblem(label),
                            compact: draft.layout.compact,
                            showMap: draft.layout.showMap,
                            accentColor,
                        })
                    )
                previewPlaceholder = editor.preview.resultsNone
                previewNote = event ? editor.preview.resultsEmpty : null
                break
            }
            case "competition":
                previewPlaceholder = editor.preview.competitionNote
                break
        }
        // Text only, as the bot posts it, with the permission named (P2-B09).
        if (
            !canAttach &&
            (draft.kind === "server" ||
                draft.kind === "servers" ||
                draft.kind === "league")
        )
            previewNote = [
                fill(editor.preview.noAttach, {
                    permission:
                        dictionary.discordPanelStatus.permissions.attach_files,
                    channel: channelName ?? editor.preview.noChannel,
                }),
                previewNote,
            ]
                .filter(Boolean)
                .join(" ")
    }

    // ---- Save and actions -----------------------------------------------------------
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [collapsed, setCollapsed] = useState<{
        look: boolean
        refresh: boolean
    }>({
        look: !panelId,
        refresh: !panelId,
    })
    const changes =
        draft && loaded
            ? draftChanges(draft, loaded.saved) + joinPatches.length
            : 0
    const problems = draft ? draftProblems(draft) : []
    const busy = saving || uploading
    const sent = Boolean(item?.sent)
    // A new calendar panel takes over the calendar the clan already has in
    // Discord: saving sends it, so its message is edited, not posted again.
    const adoptsCalendar =
        !panelId &&
        draft?.kind === "calendar" &&
        Boolean(props.calendarSettingChannelId) &&
        Boolean(overview) &&
        !overview!.panels.some((panel) => panel.kind === "calendar")
    const unsent = (!item || item.state === "unsent") && !adoptsCalendar

    async function save(send: boolean) {
        if (!draft || !loaded) return
        if (problems.length) {
            toast.error(editor.problems[problems[0]!])
            return
        }
        if (joinProblems) {
            toast.error(editor.errors.unavailable)
            return
        }
        setSaving(true)
        try {
            // Join details first: the panel then points at a server with its link.
            const ensure =
                draft.kind === "server" &&
                draft.content.joinButton &&
                draft.connectionId &&
                !servers[draft.connectionId]
                    ? [[draft.connectionId, {}] as const]
                    : []
            for (const [connectionId, patch] of [...joinPatches, ...ensure]) {
                const result = await saveServerJoin(
                    serverId,
                    connectionId,
                    patch
                )
                if (result.status !== "saved") {
                    toast.error(
                        result.error === "encryption_unavailable"
                            ? editor.errors.encryption_unavailable
                            : result.field === "address" ||
                                result.field === "joinCode" ||
                                result.field === "password"
                              ? editor.errors[result.field]
                              : editor.errors.unavailable
                    )
                    return
                }
            }
            const result = await savePanelSettings(serverId, {
                panelId,
                settings: draftToSettings(draft),
                send,
                expectedRevision: loaded.revision,
            })
            if (!result.ok) {
                const known = result.error as keyof typeof editor.errors
                toast.error(editor.errors[known] ?? editor.errors.unavailable)
                return
            }
            if (adoptsCalendar)
                // The panel owns the calendar now; the old channel setting
                // would bring it back if the panel were ever removed.
                await saveDiscordSettings(serverId, {
                    calendarChannelId: null,
                }).catch(() => null)
            toast.success(send ? editor.savedSent : editor.saved)
            setJoinEdits({})
            setLoaded({ saved: draft, draft, revision: result.revision })
            if (!panelId)
                router.replace(
                    `${props.hrefs.panels}/${encodeURIComponent(result.id)}`
                )
            else await refresh()
        } finally {
            setSaving(false)
        }
    }

    async function act(
        action:
            | "publish"
            | "refresh"
            | "pause"
            | "resume"
            | "retry"
            | "delete"
            | "remove"
    ) {
        if (!panelId) return
        if (action === "delete" && !window.confirm(editor.bar.deleteConfirm))
            return
        if (action === "remove" && !window.confirm(editor.bar.removeConfirm))
            return
        setSaving(true)
        try {
            const result = await requestPanelAction(serverId, panelId, action)
            if (result.ok) {
                toast.success(text.actions.accepted[action])
                if (action === "remove") {
                    router.push(props.hrefs.panels)
                    return
                }
                await refresh()
            } else
                toast.error(
                    result.error === "not_sent"
                        ? text.actions.notSent
                        : result.error === "removing"
                          ? text.actions.removing
                          : text.actions.failed
                )
        } finally {
            setSaving(false)
        }
    }

    // ---- Render ---------------------------------------------------------------------
    if (panelId && !item)
        return (
            <p
                role={status === "ready" ? "alert" : "status"}
                className="text-muted-foreground rounded-2xl border px-5 py-6 text-sm"
            >
                {status === "ready" ? (
                    <>
                        {editor.notFound}{" "}
                        <Link
                            href={props.hrefs.panels}
                            className="text-foreground underline underline-offset-3"
                        >
                            {editor.back}
                        </Link>
                    </>
                ) : status === "failed" ? (
                    text.list.loadFailed
                ) : (
                    editor.loading
                )}
            </p>
        )
    if (!draft || !loaded) return null

    const sources = overview?.sources ?? []
    const kindGame =
        draft.kind === "server"
            ? sources.find(
                  (source) => source.connectionId === draft.connectionId
              )?.gameId
            : draft.kind === "results"
              ? draft.gameId
              : draft.kind === "league"
                ? "wardogs"
                : null
    const defaultTitle =
        draft.kind === "server"
            ? (nameOf(draft.connectionId) ?? "")
            : draft.kind === "servers"
              ? getPanelMessages(props.clan.language).live.combinedTitle
              : draft.kind === "results"
                ? fill(text.list.titles.results, {
                      game: text.games[draft.gameId],
                  })
                : draft.kind === "league"
                  ? editor.types.league.title
                  : draft.kind === "calendar"
                    ? text.list.titles.calendar
                    : (props.competitions.find(
                          (entry) => entry.id === draft.competitionId
                      )?.name ?? text.list.titles.competition)
    const title =
        loaded.saved.title.trim() || (panelId ? defaultTitle : editor.newTitle)
    const messageUrl = discordMessageUrl(props.guildId, item?.message ?? null)
    const ctx: EditorContext = {
        serverId,
        draft,
        update,
        dictionary,
        locale,
        now,
        sent,
        takenKinds: takenPanelKinds({
            panels: overview?.panels ?? [],
            currentId: panelId,
            enabledGames: props.enabledGames,
        }),
        resultsTaken: resultsGamesTaken(overview?.panels ?? [], panelId),
        sources,
        servers,
        joins,
        setJoin,
        live: (connectionId) =>
            overview ? sourceLive({ connectionId }, overview, now) : null,
        channels: metadata?.channels ?? null,
        roles: metadata?.roles ?? null,
        channelCheck,
        verifyChannel: () => void verifyChannel(),
        channelPrivate,
        ticketCategories: props.ticketCategories,
        eventCategories: props.eventCategories,
        competitions: props.competitions,
        enabledGames: props.enabledGames,
        defaultStyle: props.defaultStyle,
        clanAccentHex: props.clan.accentHex,
        joinUrl: predictedJoinUrl,
        disabled: saving,
        setUploading,
        hrefs: props.hrefs,
    }
    let step = 0
    const next = () => ++step
    const steps = (
        <>
            <TypeStep ctx={ctx} number={next()} />
            {draft.kind === "server" ? (
                <ServerStep ctx={ctx} number={next()} />
            ) : null}
            {draft.kind === "servers" ? (
                <ServersStep ctx={ctx} number={next()} />
            ) : null}
            {draft.kind === "results" ? (
                <GameStep ctx={ctx} number={next()} />
            ) : null}
            {draft.kind === "calendar" ? (
                <CalendarStep ctx={ctx} number={next()} />
            ) : null}
            {draft.kind === "competition" ? (
                <CompetitionStep ctx={ctx} number={next()} />
            ) : null}
            <ChannelStep ctx={ctx} number={next()} />
            {draft.kind === "server" ? (
                <ServerContentStep ctx={ctx} number={next()} />
            ) : null}
            {draft.kind === "servers" ? (
                <ServersContentStep ctx={ctx} number={next()} />
            ) : null}
            {draft.kind === "results" ? (
                <ResultsContentStep ctx={ctx} number={next()} />
            ) : null}
            {draft.kind === "league" ? (
                <LeagueContentStep
                    ctx={ctx}
                    number={next()}
                    channelName={channelName}
                />
            ) : null}
            <LookStep
                ctx={ctx}
                number={next()}
                collapsed={collapsed.look}
                onToggle={() =>
                    setCollapsed((current) => ({
                        ...current,
                        look: !current.look,
                    }))
                }
                defaultTitle={defaultTitle}
            />
            <RefreshStep
                ctx={ctx}
                number={next()}
                collapsed={collapsed.refresh}
                onToggle={() =>
                    setCollapsed((current) => ({
                        ...current,
                        refresh: !current.refresh,
                    }))
                }
            />
        </>
    )

    const mainServer = draft.kind === "server" ? draft.connectionId : null
    const mainSource = mainServer
        ? sources.find((source) => source.connectionId === mainServer)
        : null
    const mainTest = mainServer ? tests[mainServer] : undefined
    const mainFacts = mainServer ? facts[mainServer] : null
    const dataServers = relevant.map((connectionId) => ({
        connectionId,
        name: nameOf(connectionId) ?? text.list.titles.unknownServer,
        provider:
            sources.find((source) => source.connectionId === connectionId)
                ?.provider ?? null,
        state: tests[connectionId] ?? null,
    }))
    const side = (
        <>
            <PreviewCard
                title={previewTitle}
                views={previewViews}
                placeholder={previewPlaceholder}
                note={previewNote}
                language={props.clan.language}
                messageStyle={props.clan.messageStyle}
                labels={dictionary.discordPreview}
                now={now}
                timeZone={props.clan.timeZone}
                mentions={{
                    channels: Object.fromEntries(
                        (metadata?.channels ?? []).map((channel) => [
                            channel.id,
                            channel.name,
                        ])
                    ),
                    roles: Object.fromEntries(
                        (metadata?.roles ?? []).map((role) => [
                            role.id,
                            role.name,
                        ])
                    ),
                }}
                authorTime={fill(editor.preview.author, {
                    time: clockTime(now, locale),
                })}
                edited={sent}
            />
            {mainServer && mainSource && draft.content.joinButton ? (
                <JoinPageMock
                    url={
                        predictedJoinUrl(mainServer) ?? `${props.siteUrl}/join`
                    }
                    name={draft.title.trim() || mainSource.name || "—"}
                    game={
                        mainSource.gameId === "wardogs"
                            ? "wardogs"
                            : "hell_let_loose"
                    }
                    map={mainFacts?.map?.name ?? null}
                    players={mainFacts?.players ?? null}
                    capacity={mainFacts?.capacity ?? null}
                    address={previewServers[mainServer]?.address ?? null}
                    joinCode={previewServers[mainServer]?.joinCode ?? null}
                    dictionary={dictionary}
                />
            ) : null}
            {dataServers.length ? (
                <ServerDataCard
                    servers={dataServers}
                    multiple={draft.kind === "servers"}
                    loading={dataServers.some(
                        (server) => server.state?.status === "loading"
                    )}
                    onLoad={() => void loadData(relevant)}
                    seeds={Object.fromEntries(
                        relevant.map((id) => [id, seeds[id]?.running ?? null])
                    )}
                    now={now}
                    locale={locale}
                    dictionary={dictionary}
                />
            ) : null}
            {mainSource && overview ? (
                <SourceCard
                    source={mainSource}
                    detail={sourceDetails[mainSource.connectionId] ?? null}
                    live={sourceLive(mainSource, overview, now)}
                    lastReadAt={
                        mainTest?.status === "done" &&
                        mainTest.result.status === "ok"
                            ? mainTest.result.readAt
                            : (item?.timeline.dataAt ?? null)
                    }
                    gameServersHref={props.hrefs.gameServers}
                    now={now}
                    locale={locale}
                    dictionary={dictionary}
                />
            ) : null}
            <DeliveryCard
                item={item}
                channel={channelName ?? editor.preview.noChannel}
                messageUrl={messageUrl}
                people={overview?.people ?? {}}
                onRetry={() => void act("retry")}
                busy={busy}
                now={now}
                locale={locale}
                dictionary={dictionary}
            />
        </>
    )

    return (
        <div className="space-y-5 pb-4">
            <header className="space-y-2">
                <Link
                    href={props.hrefs.panels}
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
                >
                    <ChevronLeft className="size-4" aria-hidden="true" />
                    {editor.back}
                </Link>
                <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px] sm:leading-9">
                        {title}
                    </h1>
                    {kindGame === "hell_let_loose" || kindGame === "wardogs" ? (
                        <GameChip
                            game={kindGame}
                            label={text.games[kindGame]}
                        />
                    ) : null}
                </div>
                <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                    <StateChip
                        state={item?.state ?? "unsent"}
                        label={
                            dictionary.discordPanelStatus.states[
                                item?.state ?? "unsent"
                            ]
                        }
                    />
                    {item && item.state !== "unsent" ? (
                        <>
                            <span>
                                {[
                                    fill(editor.statusChannel, {
                                        channel: channelLabel(
                                            item.channelId,
                                            metadata?.channels ?? null,
                                            text.list.meta.unknownChannel
                                        ),
                                    }),
                                    item.timeline.lastUpdateAt
                                        ? fill(editor.statusUpdated, {
                                              ago: timeAgo(
                                                  item.timeline.lastUpdateAt,
                                                  now,
                                                  locale
                                              ),
                                          })
                                        : null,
                                    item.timeline.nextUpdateAt &&
                                    item.state === "published"
                                        ? fill(editor.statusNext, {
                                              in: timeIn(
                                                  item.timeline.nextUpdateAt,
                                                  now,
                                                  locale,
                                                  text.time
                                              ),
                                          })
                                        : null,
                                ]
                                    .filter(Boolean)
                                    .join(" · ")}
                            </span>
                            {messageUrl ? (
                                <OpenInDiscord
                                    href={messageUrl}
                                    label={editor.openInDiscord}
                                />
                            ) : null}
                        </>
                    ) : (
                        <span>{editor.newStatus}</span>
                    )}
                </div>
            </header>
            <div className="grid items-start gap-5 xl:grid-cols-2">
                <div className="min-w-0 space-y-4">{steps}</div>
                <aside className="min-w-0 space-y-4 xl:sticky xl:top-4">
                    {side}
                </aside>
            </div>
            <div
                data-mobile-action-bar=""
                className={cn(
                    "bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky bottom-0 z-30 -mx-1 flex flex-col gap-3 rounded-xl border px-4 py-3 shadow-sm backdrop-blur",
                    // A sent panel: the note on top, the actions under it (P2-34);
                    // an unsent one: the note and the two buttons on one line (P2-49).
                    unsent && "sm:flex-row sm:items-center sm:justify-between"
                )}
            >
                <p role="status" className="text-sm">
                    {unsent ? (
                        <>
                            {changes ? (
                                <span className="font-medium">
                                    {unsavedChangesLabel(
                                        changes,
                                        locale,
                                        dictionary.settingsHub.saveBar
                                    )}
                                    {" · "}
                                </span>
                            ) : null}
                            {editor.bar.notInDiscord}
                        </>
                    ) : (
                        <>
                            <span
                                className={
                                    changes
                                        ? "font-medium"
                                        : "text-muted-foreground"
                                }
                            >
                                {unsavedChangesLabel(
                                    changes,
                                    locale,
                                    dictionary.settingsHub.saveBar
                                )}
                            </span>
                            <span className="text-muted-foreground">
                                {" · "}
                                {adoptsCalendar
                                    ? fill(editor.bar.adoptCalendar, {
                                          channel:
                                              channelName ??
                                              editor.preview.noChannel,
                                      })
                                    : item?.paused
                                      ? editor.bar.pausedNote
                                      : fill(editor.bar.editsMessage, {
                                            channel:
                                                channelName ??
                                                editor.preview.noChannel,
                                        })}
                            </span>
                        </>
                    )}
                </p>
                <div
                    role="group"
                    aria-label={editor.bar.actions}
                    className={cn(
                        "flex flex-wrap gap-2",
                        unsent && "sm:justify-end"
                    )}
                >
                    {unsent ? (
                        <>
                            {item && !changes ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="text-destructive rounded-lg"
                                    disabled={busy}
                                    onClick={() => void act("remove")}
                                >
                                    <Trash2
                                        className="size-4"
                                        aria-hidden="true"
                                    />
                                    {editor.bar.removePanel}
                                </Button>
                            ) : null}
                            {changes && item ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="rounded-lg"
                                    disabled={busy}
                                    onClick={() =>
                                        setLoaded({
                                            ...loaded,
                                            draft: loaded.saved,
                                        })
                                    }
                                >
                                    {editor.bar.discard}
                                </Button>
                            ) : null}
                            <Button
                                type="button"
                                variant="outline"
                                className="rounded-lg"
                                disabled={busy || (!changes && Boolean(item))}
                                onClick={() => void save(false)}
                            >
                                {saving ? editor.bar.saving : editor.bar.save}
                            </Button>
                            <Button
                                type="button"
                                className="rounded-lg"
                                disabled={busy || problems.length > 0}
                                onClick={() =>
                                    item && !changes
                                        ? void act("publish")
                                        : void save(true)
                                }
                            >
                                <Send className="size-4" aria-hidden="true" />
                                {editor.bar.publish}
                            </Button>
                        </>
                    ) : (
                        <>
                            {adoptsCalendar ? null : (
                                <>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="rounded-lg border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-900 dark:text-red-400"
                                        disabled={busy}
                                        onClick={() => void act("delete")}
                                    >
                                        <Trash2
                                            className="size-4"
                                            aria-hidden="true"
                                        />
                                        {editor.bar.delete}
                                    </Button>
                                    {item?.paused ? (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="rounded-lg"
                                            disabled={busy}
                                            onClick={() => void act("resume")}
                                        >
                                            <Play
                                                className="size-4"
                                                aria-hidden="true"
                                            />
                                            {editor.bar.resume}
                                        </Button>
                                    ) : (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="rounded-lg"
                                            disabled={busy}
                                            onClick={() => void act("pause")}
                                        >
                                            <Pause
                                                className="size-4"
                                                aria-hidden="true"
                                            />
                                            {editor.bar.pause}
                                        </Button>
                                    )}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="rounded-lg"
                                        disabled={busy || Boolean(item?.paused)}
                                        onClick={() => void act("refresh")}
                                    >
                                        <RefreshCw
                                            className="size-4"
                                            aria-hidden="true"
                                        />
                                        {editor.bar.refresh}
                                    </Button>
                                </>
                            )}
                            <Button
                                type="button"
                                className="rounded-lg"
                                disabled={
                                    busy ||
                                    (!changes && !adoptsCalendar) ||
                                    problems.length > 0
                                }
                                onClick={() => void save(adoptsCalendar)}
                            >
                                {saving ? editor.bar.saving : editor.bar.save}
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
