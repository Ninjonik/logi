"use client"
import {
    nextTour,
    parseBookmark,
    tourKey,
    workspaceTour,
    type OnboardingState,
    type TourKind,
} from "@/domain/onboarding/tours"
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react"
import {
    walkthroughSteps,
    walkHref,
    matchesWalkRoute,
    type WalkStep,
} from "@/domain/onboarding/walkthrough"
import {
    NextStep,
    NextStepProvider,
    useNextStep,
    type CardComponentProps,
    type Tour,
} from "nextstepjs"
import {
    ArrowLeft,
    ArrowRight,
    Check,
    Pause,
    Play,
    RotateCcw,
    X,
} from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { WalkthroughContext } from "./onboarding/walkthrough-context"
import { getWalkthroughCopy } from "@/i18n/messages/walkthrough"
import { getOnboardingCopy } from "@/i18n/messages/onboarding"
import { canAdminWorkspace } from "@/lib/workspace-admin"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { useReducedMotion } from "motion/react"
import { Badge } from "@/components/ui/badge"
import type { Guild } from "@/types/domain"
import type { Locale } from "@/i18n/config"
import { createPortal } from "react-dom"
import { toast } from "sonner"

type Props = {
    children: ReactNode
    dictionary: Dictionary
    servers: Guild[]
    onboarding?: OnboardingState
    userId: string
    locale: Locale
    inviteUrlByGuildId: Record<string, string>
}
type Active = {
    kind: TourKind
    workspaceId?: string
    key: string
    steps: WalkStep[]
    index: number
    exampleNow: number
    returnHref: string
}
type Controls = {
    dictionary: Dictionary
    locale: Locale
    active: Active
    phase: number
    paused: boolean
    reduced: boolean
    missing: boolean
    inviteUrl?: string
    next(): void
    back(): void
    exit(): void
    toggle(): void
    replay(): void
}
const GuideControls = createContext<Controls | null>(null)
function read(key: string) {
    try {
        return localStorage.getItem(key)
    } catch {
        return null
    }
}
function write(key: string, value: unknown) {
    try {
        localStorage.setItem(key, JSON.stringify(value))
    } catch {
        /* The live tour remains usable without storage. */
    }
}

export function DashboardOnboarding(props: Props) {
    return (
        <NextStepProvider>
            <Walkthrough {...props} />
        </NextStepProvider>
    )
}
function Walkthrough({
    children,
    dictionary,
    servers,
    onboarding,
    userId,
    locale,
    inviteUrlByGuildId,
}: Props) {
    const router = useRouter(),
        pathname = usePathname(),
        search = useSearchParams()
    const { startNextStep, closeNextStep } = useNextStep()
    const workspaceId =
        pathname.match(/\/servers\/([^/]+)/)?.[1] ??
        search.get("workspace") ??
        undefined
    const server = servers.find((s) => s.id === workspaceId)
    const candidate =
        server ??
        servers.find((s) => canAdminWorkspace(s, userId)) ??
        servers[0]
    const context = useMemo(
        () => ({
            workspaceId: server?.id,
            canManage: server ? canAdminWorkspace(server, userId) : false,
            limited: server?.workspaceMode === "competitions",
            botInside: server?.botInside ?? false,
        }),
        [server, userId]
    )
    const [fallbackExampleNow] = useState(Date.now)
    const [active, setActive] = useState<Active | null>(null)
    const [ready, setReady] = useState<{
        key: string
        selector: string
        missing: boolean
    } | null>(null)
    const [phase, setPhase] = useState(0),
        [paused, setPaused] = useState(false),
        [manualPlay, setManualPlay] = useState(false)
    const reducedMotion = useReducedMotion()
    const completed = useRef(new Set<string>()),
        suppress = useRef(false)
    const storageKey = useCallback(
        (key: string) => `logi:onboarding:${userId}:${key}`,
        [userId]
    )
    const step = active?.steps[active.index] ?? null
    const href =
        step && active ? walkHref(locale, active.workspaceId, step) : null
    const identity =
        active && step ? `${active.key}:${step.id}:${pathname}` : ""
    const isReady =
        ready?.key === identity &&
        Boolean(identity) &&
        Boolean(href && matchesWalkRoute(pathname, href))
    const copy = getOnboardingCopy(locale),
        words = getWalkthroughCopy(locale)
    const hasMissingBot = Boolean(
        candidate &&
        !candidate.botInside &&
        candidate.workspaceMode !== "competitions" &&
        canAdminWorkspace(candidate, userId)
    )
    const launch = useCallback(
        (kind: TourKind, restart = false) => {
            closeNextStep()
            const tourServer = candidate
            const id = tourServer?.id,
                key = tourKey(kind, id)
            const steps = walkthroughSteps(
                kind,
                kind === "welcome"
                    ? !hasMissingBot
                    : (candidate?.botInside ?? false)
            )
            if (!tourServer || !canAdminWorkspace(tourServer, userId)) {
                for (const stage of steps) {
                    if (stage.chapter === "mode") {
                        stage.path = ""
                        stage.selector = "#onboarding-workspace-switcher"
                    }
                }
            }
            const bookmark = parseBookmark(
                read(storageKey(key)),
                steps.map((s) => s.id)
            )
            const index =
                restart || bookmark?.status !== "active"
                    ? 0
                    : Math.max(
                          0,
                          steps.findIndex((s) => s.id === bookmark.step)
                      )
            const root = id
                ? `/${locale}/dashboard/servers/${id}`
                : `/${locale}/dashboard`
            setPhase(0)
            setPaused(false)
            setManualPlay(false)
            setActive({
                kind,
                exampleNow: Date.now(),
                workspaceId: id,
                key,
                steps,
                index,
                returnHref: pathname.includes("/onboarding-example")
                    ? root
                    : `${pathname}${search.size ? `?${search.toString()}` : ""}`,
            })
            router.push(walkHref(locale, id, steps[index]))
        },
        [
            candidate,
            userId,
            closeNextStep,
            hasMissingBot,
            locale,
            pathname,
            router,
            search,
            storageKey,
        ]
    )
    useEffect(() => {
        for (const key of Object.keys(
            onboarding?.workspaceTourCompletedAt ?? {}
        ))
            completed.current.add(key)
        for (const kind of [
            "welcome",
            "manager",
            "competitions",
            "member",
            "competition-member",
        ] as const) {
            const key = tourKey(kind, context.workspaceId)
            if (
                parseBookmark(
                    read(storageKey(key)),
                    walkthroughSteps(kind, context.botInside).map((s) => s.id)
                )?.status === "done"
            )
                completed.current.add(key)
        }
        if (active || suppress.current) return
        const kind = nextTour(context, completed.current)
        if (!kind) return
        const timer = setTimeout(() => launch(kind), 650)
        return () => clearTimeout(timer)
    }, [active, context, launch, onboarding, storageKey])
    useEffect(() => {
        const replay = () => {
            suppress.current = true
            launch(server ? workspaceTour(context) : "welcome", true)
        }
        window.addEventListener("logi:restart-onboarding", replay)
        return () =>
            window.removeEventListener("logi:restart-onboarding", replay)
    }, [context, launch, server])
    useEffect(() => {
        if (active && step)
            write(storageKey(active.key), { step: step.id, status: "active" })
    }, [active, step, storageKey])
    async function persist(key: string) {
        try {
            const response = await fetch("/api/user/onboarding", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    milestone: "workspace_tour",
                    workspaceId: key,
                }),
            })
            if (!response.ok) throw new Error("progress")
        } catch {
            toast.error(dictionary.onboarding.saveError, {
                action: {
                    label: copy.labels.retry,
                    onClick: () => void persist(key),
                },
            })
        }
    }
    function exit(done = true) {
        if (!active) return
        closeNextStep()
        suppress.current = true
        if (done) {
            completed.current.add(active.key)
            write(storageKey(active.key), {
                step: "finish",
                status: "done",
            })
            void persist(active.key)
        }
        const back = active.returnHref
        setActive(null)
        router.replace(back)
    }
    function move(index: number) {
        if (!active) return
        if (index >= active.steps.length) {
            if (active.kind === "welcome" && candidate) {
                completed.current.add(active.key)
                write(storageKey(active.key), {
                    step: "finish",
                    status: "done",
                })
                void persist(active.key)
                launch(
                    workspaceTour({
                        workspaceId: candidate.id,
                        canManage: canAdminWorkspace(candidate, userId),
                        limited: candidate.workspaceMode === "competitions",
                        botInside: candidate.botInside ?? false,
                    }),
                    true
                )
            } else exit()
            return
        }
        if (index < 0) return
        closeNextStep()
        setPhase(0)
        setPaused(false)
        setManualPlay(false)
        setActive({ ...active, index })
        router.push(walkHref(locale, active.workspaceId, active.steps[index]))
    }
    const touring = Boolean(active)
    useEffect(() => {
        if (!touring) return
        const root = document.documentElement
        const previous = root.style.overflowX
        root.style.overflowX = "clip"
        window.scrollTo({ left: 0, top: window.scrollY, behavior: "instant" })
        return () => {
            root.style.overflowX = previous
        }
    }, [touring])
    // Do not run a spotlight against stale page geometry during route transitions.
    useEffect(() => {
        if (!active || !step || !href) return
        closeNextStep()
        if (!matchesWalkRoute(pathname, href)) return
        const started = Date.now()
        let finished = false,
            frame = 0
        const visible = (element: Element | null) =>
            Boolean(
                element &&
                element.getBoundingClientRect().width &&
                element.getBoundingClientRect().height
            )
        const check = () => {
            if (finished) return
            let selector = step.selector
            let target = document.querySelector(selector)
            let missing = false
            if (!visible(target) && Date.now() - started > 2000) {
                selector = "#onboarding-page h1"
                target = document.querySelector(selector)
                missing = true
            }
            if (!visible(target)) return
            finished = true
            setReady({ key: identity, selector, missing })
            frame = requestAnimationFrame(() => startNextStep("logi-walk"))
        }
        const timer = setInterval(check, 100)
        const observer = new MutationObserver(check)
        observer.observe(document.body, { childList: true, subtree: true })
        check()
        return () => {
            finished = true
            clearInterval(timer)
            observer.disconnect()
            cancelAnimationFrame(frame)
        }
        // Only route and stage changes restart target discovery; animation frames do not.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        active?.key,
        active?.index,
        closeNextStep,
        href,
        identity,
        pathname,
        startNextStep,
    ])
    useEffect(() => {
        if (
            !active ||
            !step?.watch ||
            paused ||
            (reducedMotion && !manualPlay) ||
            phase >= 6
        )
            return
        const timer = setTimeout(
            () => setPhase((p) => Math.min(6, p + 0.08)),
            90
        )
        return () => clearTimeout(timer)
    }, [active, step, paused, reducedMotion, manualPlay, phase])
    // Only the highlighted tutorial action may run. Real submit, edit, import and upload controls remain blocked.
    useEffect(() => {
        if (!active || !step) return
        const inCard = (target: EventTarget | null) =>
            target instanceof Element &&
            Boolean(target.closest("[data-onboarding-card]"))
        const isAction = (target: EventTarget | null) =>
            step.action === "advance" &&
            target instanceof Element &&
            Boolean(
                target.closest(
                    isReady && ready ? ready.selector : step.selector
                )
            )
        const click = (event: MouseEvent) => {
            if (inCard(event.target)) return
            event.preventDefault()
            event.stopImmediatePropagation()
            if (isAction(event.target)) move(active.index + 1)
        }
        const key = (event: KeyboardEvent) => {
            if (event.key === "Tab") {
                const card = document.querySelector("[data-onboarding-card]")
                const candidates = Array.from(
                    card?.querySelectorAll<HTMLElement>(
                        "button:not([disabled]), a[href], input, select"
                    ) ?? []
                )
                const action =
                    step.action === "advance"
                        ? document.querySelector<HTMLElement>(
                              isReady && ready ? ready.selector : step.selector
                          )
                        : null
                if (action && action.getBoundingClientRect().width)
                    candidates.unshift(action)
                if (candidates.length) {
                    event.preventDefault()
                    event.stopImmediatePropagation()
                    const current = candidates.indexOf(
                        document.activeElement as HTMLElement
                    )
                    const next = event.shiftKey
                        ? current <= 0
                            ? candidates.length - 1
                            : current - 1
                        : (current + 1) % candidates.length
                    candidates[next].focus({ preventScroll: true })
                }
                return
            }
            if (event.key === "Escape") {
                event.preventDefault()
                event.stopImmediatePropagation()
                exit()
                return
            }
            if (
                inCard(event.target) &&
                event.target instanceof HTMLElement &&
                ["SELECT", "INPUT", "TEXTAREA"].includes(event.target.tagName)
            )
                return
            if (event.key === "ArrowRight") {
                event.preventDefault()
                event.stopImmediatePropagation()
                move(active.index + 1)
                return
            }
            if (event.key === "ArrowLeft") {
                event.preventDefault()
                event.stopImmediatePropagation()
                move(active.index - 1)
                return
            }
            if (!inCard(event.target) && event.key !== "Tab") {
                event.preventDefault()
                event.stopImmediatePropagation()
                if (
                    (event.key === "Enter" || event.key === " ") &&
                    isAction(event.target)
                )
                    move(active.index + 1)
            }
        }
        const blockEdit = (event: Event) => {
            if (inCard(event.target)) return
            event.preventDefault()
            event.stopImmediatePropagation()
        }
        const pointer = (event: PointerEvent) => {
            if (!inCard(event.target) && !isAction(event.target))
                blockEdit(event)
        }
        const editEvents = [
            "beforeinput",
            "paste",
            "cut",
            "drop",
            "submit",
            "contextmenu",
        ] as const
        for (const name of editEvents)
            document.addEventListener(name, blockEdit, true)
        document.addEventListener("pointerdown", pointer, true)
        document.addEventListener("click", click, true)
        document.addEventListener("keydown", key, true)
        const pop = () => exit(false)
        window.addEventListener("popstate", pop)
        return () => {
            for (const name of editEvents)
                document.removeEventListener(name, blockEdit, true)
            document.removeEventListener("pointerdown", pointer, true)
            document.removeEventListener("click", click, true)
            document.removeEventListener("keydown", key, true)
            window.removeEventListener("popstate", pop)
        }
        // Event handlers use this render's stage and never retain a route or callback from a previous step.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, step, isReady, ready])
    const tourServer = servers.find((s) => s.id === active?.workspaceId)
    const title = step ? copy.chapters[step.chapter][0] : ""
    const body = step?.instruction
        ? words[step.instruction]
        : step
          ? copy.chapters[step.chapter][1]
          : ""
    const controls: Controls | null = active
        ? {
              dictionary,
              locale,
              active,
              phase,
              paused,
              reduced: Boolean(reducedMotion && !manualPlay),
              missing: ready?.missing ?? false,
              inviteUrl: active.workspaceId
                  ? inviteUrlByGuildId[active.workspaceId]
                  : undefined,
              next: () => move(active.index + 1),
              back: () => move(active.index - 1),
              exit: () => exit(),
              toggle: () => {
                  setManualPlay(true)
                  setPaused(!paused)
              },
              replay: () => {
                  setManualPlay(true)
                  setPhase(0)
                  setPaused(false)
              },
          }
        : null
    const engineSteps = useMemo<Tour[]>(
        () => [
            {
                tour: "logi-walk",
                steps: [
                    {
                        title,
                        content: body,
                        selector:
                            isReady && ready
                                ? ready.selector
                                : (step?.selector ?? "#onboarding-page"),
                        side:
                            step?.chapter === "welcome" ||
                            step?.chapter === "workspace" ||
                            step?.chapter === "account"
                                ? "bottom"
                                : "right",
                        pointerPadding: 8,
                        pointerRadius: 10,
                        cardOffset: 16,
                        scrollOffset: 96,
                        selectorRetryAttempts: 30,
                        selectorRetryDelay: 150,
                        blockKeyboardControl: true,
                        disableInteraction: false,
                    },
                ],
            },
        ],
        [title, body, isReady, ready, step?.selector, step?.chapter]
    )
    return (
        <WalkthroughContext.Provider
            value={{
                active: Boolean(active),
                limited:
                    active?.kind === "competitions" ||
                    active?.kind === "competition-member" ||
                    Boolean(
                        servers.find((s) => s.id === active?.workspaceId)
                            ?.workspaceMode === "competitions"
                    ),
                canManage: Boolean(
                    tourServer && canAdminWorkspace(tourServer, userId)
                ),
                exampleNow: active?.exampleNow ?? fallbackExampleNow,
                step,
                phase: reducedMotion && !manualPlay ? 6 : phase,
                workspaceId: active?.workspaceId,
                next: () => move((active?.index ?? 0) + 1),
            }}
        >
            <GuideControls.Provider value={controls}>
                <NextStep
                    steps={engineSteps}
                    cardComponent={WalkCard}
                    shadowRgb="0,0,0"
                    shadowOpacity="0.7"
                    overlayZIndex={120}
                    cardTransition={{ duration: reducedMotion ? 0 : 0.18 }}
                    scrollToTop={false}
                    onSkip={() => exit()}
                >
                    {children}
                </NextStep>
                {active && !isReady && (
                    <div className="fixed inset-0 z-[119] bg-black/60">
                        <section
                            data-onboarding-card=""
                            role="status"
                            className="bg-background fixed right-4 bottom-4 max-w-[calc(100vw-2rem)] rounded-xl border p-4 shadow-xl"
                        >
                            <p className="text-sm">{words.loading}</p>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => exit()}
                                className="mt-2"
                            >
                                {dictionary.onboarding.skip}
                            </Button>
                        </section>
                    </div>
                )}
            </GuideControls.Provider>
        </WalkthroughContext.Provider>
    )
}
function WalkCard({ step }: CardComponentProps) {
    const controls = useContext(GuideControls)
    const ref = useRef<HTMLElement>(null)
    useEffect(() => {
        ref.current?.focus({ preventScroll: true })
    }, [controls?.active.index])
    if (!controls) return null
    const { active, dictionary: d } = controls,
        words = getWalkthroughCopy(controls.locale)
    const current = active.steps[active.index],
        last = active.index === active.steps.length - 1
    return createPortal(
        <section
            ref={ref}
            tabIndex={-1}
            data-onboarding-card=""
            role="dialog"
            aria-label={String(step.title)}
            style={{
                position: "fixed",
                bottom: 16,
                right: current.chapter === "finish" ? undefined : 16,
                left: current.chapter === "finish" ? 16 : undefined,
                zIndex: 125,
            }}
            className="bg-background text-foreground max-h-[calc(100dvh-2rem)] w-[min(350px,calc(100vw-2rem))] overflow-y-auto rounded-xl border p-4 shadow-2xl outline-none"
        >
            <div className="flex items-center justify-between gap-3">
                <Badge variant="secondary" className="text-[10px]">
                    {current.mock
                        ? words.example
                        : getOnboardingCopy(controls.locale).labels.tour}
                </Badge>
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label={d.onboarding.skip}
                    onClick={controls.exit}
                >
                    <X className="size-4" />
                </Button>
            </div>
            <h2 className="mt-3 text-base font-semibold">{step.title}</h2>
            <div className="text-muted-foreground mt-2 text-sm leading-6">
                {step.content}
            </div>
            {controls.missing && (
                <p className="text-muted-foreground mt-2 text-xs">
                    {words.missing}
                </p>
            )}
            {current.watch && (
                <div className="mt-3 flex gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={
                            controls.phase >= 6 || controls.reduced
                                ? controls.replay
                                : controls.toggle
                        }
                    >
                        {controls.phase >= 6 || controls.reduced ? (
                            <RotateCcw className="size-3" />
                        ) : controls.paused ? (
                            <Play className="size-3" />
                        ) : (
                            <Pause className="size-3" />
                        )}
                        {controls.phase >= 6 || controls.reduced
                            ? words.replay
                            : controls.paused
                              ? words.play
                              : words.pause}
                    </Button>
                </div>
            )}
            {current.chapter === "bot" && controls.inviteUrl && (
                <Button asChild className="mt-3">
                    <a
                        href={controls.inviteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {getOnboardingCopy(controls.locale).labels.invite}
                    </a>
                </Button>
            )}
            <div className="bg-muted mt-4 h-1 overflow-hidden rounded-full">
                <div
                    className="h-full bg-amber-500"
                    style={{
                        width: `${((active.index + 1) / active.steps.length) * 100}%`,
                    }}
                />
            </div>
            <p className="text-muted-foreground mt-2 text-[11px]">
                {d.onboarding.step
                    .replace("{current}", String(active.index + 1))
                    .replace("{total}", String(active.steps.length))}
            </p>
            <div className="mt-3 flex items-center justify-between gap-2">
                <button
                    type="button"
                    className="text-muted-foreground text-xs underline underline-offset-4"
                    onClick={controls.exit}
                >
                    {d.onboarding.skip}
                </button>
                <div className="flex gap-2">
                    <Button
                        size="icon"
                        variant="outline"
                        disabled={active.index === 0}
                        onClick={controls.back}
                        aria-label={d.onboarding.back}
                    >
                        <ArrowLeft className="size-4" />
                    </Button>
                    <Button size="sm" onClick={controls.next}>
                        {last ? <Check className="size-4" /> : null}
                        {last ? d.onboarding.finish : d.onboarding.next}
                        {!last ? <ArrowRight className="size-4" /> : null}
                    </Button>
                </div>
            </div>
        </section>,
        document.body
    )
}
