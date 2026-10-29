"use client"

import {
    ArrowDown,
    ArrowRight,
    BookOpen,
    CalendarDays,
    Check,
    ChevronDown,
    Code2,
    Download,
    ExternalLink,
    Github,
    MessagesSquare,
    Radio,
    Server,
    Swords,
    Trophy,
    UsersRound,
    X,
} from "lucide-react"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    motion,
    useReducedMotion,
    useMotionValue,
    useTransform,
} from "framer-motion"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { ProductShot, type ShotView } from "./product-shot"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import type { Locale } from "@/i18n/config"
import { Logo } from "@/components/logo"
import dynamic from "next/dynamic"
import { cn } from "@/lib/utils"
import Image from "next/image"
import Link from "next/link"

const LandingDiscordPreview = dynamic(() =>
    import("./discord-workflow").then((module) => module.LandingDiscordPreview)
)
const workflowKeys = ["plan", "signups", "roster"] as const
type WorkflowKey = (typeof workflowKeys)[number]
const moreFeatures = [
    { icon: CalendarDays, href: "/wiki/operations/trainings" },
    { icon: UsersRound, href: "/wiki/configuration/members" },
    { icon: Trophy, href: "/wiki/public/matches-and-competitions" },
    { icon: Swords, href: "/wiki/operations/briefings-and-stratmaps" },
    { icon: MessagesSquare, href: "/wiki/configuration/tickets" },
    { icon: Code2, href: "/api/v1/docs" },
    { icon: BookOpen, href: "/wiki/dashboard/calendar-and-articles" },
] as const

function Reveal({
    children,
    className,
}: {
    children: ReactNode
    className?: string
}) {
    const reduce = useReducedMotion()
    return (
        <motion.div
            initial={reduce !== false ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.12 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className={className}
        >
            {children}
        </motion.div>
    )
}
function Eyebrow({ children }: { children: ReactNode }) {
    return (
        <p className="mb-4 text-[11px] font-semibold tracking-[.18em] text-amber-800 uppercase dark:text-amber-400">
            {children}
        </p>
    )
}
function Points({ items }: { items: string[] }) {
    return (
        <ul className="mt-7 space-y-3">
            {items.map((item) => (
                <li
                    key={item}
                    className="flex items-start gap-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400"
                >
                    <Check className="mt-1 size-4 shrink-0 text-amber-700 dark:text-amber-400" />
                    <span>{item}</span>
                </li>
            ))}
        </ul>
    )
}
function TextLink({ href, children }: { href: string; children: ReactNode }) {
    return (
        <Link
            href={href}
            className="inline-flex items-center gap-2 rounded-sm text-sm font-medium underline-offset-4 transition-colors hover:text-amber-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-500 dark:hover:text-amber-300"
        >
            {children}
            <ArrowRight className="size-3.5" />
        </Link>
    )
}

/** Retain each preview's dimensions while showing only the current step. */
function WorkflowLayer({
    active,
    children,
}: {
    active: boolean
    children: ReactNode
}) {
    return (
        <div
            className="home-workflow-layer"
            aria-hidden={!active}
            inert={!active}
            style={{ visibility: active ? "visible" : "hidden" }}
        >
            {children}
        </div>
    )
}

export function LandingPage({
    dictionary,
    locale,
    signedIn,
    dashboardHref,
    logicommsDownloadUrl,
}: {
    dictionary: Dictionary
    locale: Locale
    signedIn: boolean
    userName?: string
    dashboardHref?: string
    logicommsDownloadUrl: string | null
}) {
    const copy = dictionary.home.landing
    const reduce = useReducedMotion()
    const [workflow, setWorkflow] = useState<WorkflowKey>("plan")
    const workflowPosition = useMotionValue(0)
    const workflowProgress = useTransform(workflowPosition, [0, 2], [0, 1])
    const currentStep = workflowKeys.indexOf(workflow)
    const workflowTrack = useRef<HTMLDivElement>(null)
    const workflowStage = useRef<HTMLDivElement>(null)
    useEffect(() => {
        const track = workflowTrack.current
        const stage = workflowStage.current
        if (!track || !stage) return
        let frame = 0
        const update = () => {
            frame = 0
            const distance = window.innerHeight * 2
            track.style.height = `${stage.offsetHeight + distance}px`
            const inset = Number.parseFloat(window.getComputedStyle(stage).top)
            const progress =
                (inset - track.getBoundingClientRect().top) / distance
            const position = Math.min(2, Math.max(0, progress * 2))
            workflowPosition.set(position)
            const selected = Math.round(position)
            setWorkflow(workflowKeys[selected])
        }
        const schedule = () => {
            if (!frame) frame = window.requestAnimationFrame(update)
        }
        const observer = new ResizeObserver(schedule)
        observer.observe(stage)
        window.addEventListener("scroll", schedule, { passive: true })
        window.addEventListener("resize", schedule)
        update()
        return () => {
            observer.disconnect()
            window.removeEventListener("scroll", schedule)
            window.removeEventListener("resize", schedule)
            window.cancelAnimationFrame(frame)
        }
    }, [workflowPosition])
    const [viewer, setViewer] = useState<ShotView | null>(null)
    const action = signedIn
        ? (dashboardHref ?? `/${locale}/dashboard`)
        : `/${locale}/login`
    const actionLabel = signedIn ? dictionary.home.openApp : copy.hero.primary

    const renderFeature = (i: number) => {
        const { icon: Icon, href } = moreFeatures[i]
        return (
            <Reveal
                key={href}
                className={cn(
                    "group rounded-2xl border border-zinc-200 bg-white p-6 transition-colors hover:border-zinc-400 dark:border-white/10 dark:bg-[#101115] dark:hover:border-white/25",
                    i === 0 && "md:col-span-2",
                    i === 5 && "md:col-span-2 lg:col-span-1"
                )}
            >
                <Link
                    href={href}
                    className="block rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                    <div className="flex items-start justify-between">
                        <Icon className="mb-6 size-5 text-zinc-500 dark:text-zinc-400" />
                        <ArrowRight className="size-4 text-zinc-400 transition-transform group-hover:translate-x-1" />
                    </div>
                    <h3 className="text-lg font-semibold tracking-tight">
                        {copy.explore.cards[i].title}
                    </h3>
                    <p className="home-body mt-3 text-sm">
                        {copy.explore.cards[i].text}
                    </p>
                </Link>
                {i === 0 ? (
                    <div className="mt-6 overflow-hidden rounded-lg border border-zinc-200 dark:border-white/10">
                        <ProductShot
                            shot="calendar"
                            title={copy.screens.calendar}
                            zoomLabel={copy.screens.zoom}
                            onOpen={setViewer}
                        />
                    </div>
                ) : null}
            </Reveal>
        )
    }

    return (
        <main className="logi-home flex-1 overflow-x-clip bg-[#fafafa] text-zinc-950 dark:bg-[#090a0c] dark:text-zinc-100">
            <section className="relative isolate overflow-hidden px-4 pt-16 sm:px-6 sm:pt-24 lg:pt-28">
                <div className="home-hero-art" aria-hidden>
                    {[0, 1, 2, 3].map((i) => (
                        <span
                            key={i}
                            style={{
                                left: `${17 + i * 17}%`,
                                top: `${-230 + i * 38}px`,
                            }}
                        />
                    ))}
                </div>
                <div className="relative mx-auto max-w-6xl text-center">
                    <motion.div
                        initial={
                            reduce !== false ? false : { opacity: 0, y: 18 }
                        }
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7 }}
                    >
                        <h1 className="mx-auto max-w-6xl text-[clamp(2.8rem,6.8vw,6.1rem)] leading-[1.02] font-semibold tracking-[-.065em] text-balance">
                            {copy.hero.title}
                            <br />
                            <span className="text-zinc-500 dark:text-zinc-400">
                                {copy.hero.accent}
                            </span>
                        </h1>
                        <p className="mx-auto mt-7 max-w-xl text-base leading-7 text-pretty text-zinc-600 sm:text-lg dark:text-zinc-400">
                            {copy.hero.description}
                        </p>
                        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                            <Button
                                asChild
                                size="lg"
                                className="h-12 rounded-xl px-5 shadow-sm"
                            >
                                <Link href={action}>
                                    <Logo
                                        size={18}
                                        alt=""
                                        className="brightness-0 invert dark:invert-0"
                                    />
                                    {actionLabel}
                                    <ArrowRight className="size-4" />
                                </Link>
                            </Button>
                            <Button
                                asChild
                                variant="outline"
                                size="lg"
                                className="h-12 rounded-xl border-zinc-300 bg-white/70 px-5 dark:border-white/15 dark:bg-white/[.035]"
                            >
                                <a href="#workflow">
                                    {copy.hero.secondary}
                                    <ArrowDown className="size-4" />
                                </a>
                            </Button>
                        </div>
                        <ul className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-zinc-500">
                            {copy.hero.proof.map((proof) => (
                                <li
                                    key={proof}
                                    className="flex items-center gap-1.5"
                                >
                                    <Check className="size-3" />
                                    {proof}
                                </li>
                            ))}
                        </ul>
                    </motion.div>
                    <Reveal className="home-hero-window relative mx-auto mt-16 max-w-[1120px] rounded-[18px] border border-zinc-300/80 bg-white/70 p-1.5 shadow-[0_30px_100px_-35px_#0004] sm:mt-20 sm:p-2 dark:border-white/15 dark:bg-[#18191c] dark:shadow-[0_30px_100px_-35px_#000c]">
                        <div className="flex items-center gap-1.5 px-3 pt-1 pb-2 sm:pb-3">
                            <span className="size-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                            <span className="size-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                            <span className="size-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                            <span className="ml-3 text-[10px] text-zinc-500">
                                Logi / {copy.screens.overview}
                            </span>
                        </div>
                        <ProductShot
                            shot="overview"
                            title={copy.screens.overview}
                            zoomLabel={copy.screens.zoom}
                            onOpen={setViewer}
                            priority
                        />
                    </Reveal>
                    <p className="mx-auto mt-5 max-w-2xl text-[11px] leading-5 text-zinc-500">
                        {copy.screens.caption}
                    </p>
                    <div className="mx-auto mt-10 flex max-w-xl flex-wrap items-center justify-center gap-x-6 gap-y-3 border-t border-zinc-200 pt-7 text-xs font-medium text-zinc-500 dark:border-white/10">
                        <span>Hell Let Loose</span>
                        <span
                            aria-hidden
                            className="size-1 rounded-full bg-zinc-400/40"
                        />
                        <span>Wardogs</span>
                        <span
                            aria-hidden
                            className="size-1 rounded-full bg-zinc-400/40"
                        />
                        <a
                            href="#setup"
                            className="inline-flex items-center gap-1.5 rounded-sm hover:text-zinc-900 dark:hover:text-zinc-200"
                        >
                            {copy.nav.setup}
                            <ArrowRight className="size-3" />
                        </a>
                    </div>
                </div>
            </section>

            <section
                id="setup"
                className="home-section mx-auto max-w-6xl px-5 pt-24 pb-20 sm:px-8 lg:pt-32 lg:pb-28"
            >
                <Reveal className="grid gap-8 lg:grid-cols-[1fr_1.35fr] lg:gap-16">
                    <div>
                        <Eyebrow>{copy.setup.eyebrow}</Eyebrow>
                        <h2 className="home-heading">{copy.setup.title}</h2>
                        <p className="home-body mt-5">
                            {copy.setup.description}
                        </p>
                        <div className="mt-7">
                            <TextLink href="/wiki/getting-started">
                                {copy.setup.guide}
                            </TextLink>
                        </div>
                    </div>
                    <ol className="space-y-1">
                        {copy.setup.steps.map((item, i) => (
                            <li
                                key={item.title}
                                className="flex gap-5 border-b border-zinc-200 py-5 first:pt-0 last:border-0 dark:border-white/10"
                            >
                                <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-zinc-300 font-mono text-xs text-zinc-500 dark:border-white/15">
                                    {i + 1}
                                </span>
                                <div>
                                    <h3 className="text-base font-semibold tracking-tight">
                                        {item.title}
                                    </h3>
                                    <p className="home-body mt-2 text-sm">
                                        {item.text}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ol>
                </Reveal>
            </section>

            <section
                id="workflow"
                className="home-section border-y border-zinc-200 bg-white px-4 py-20 sm:px-8 lg:py-28 dark:border-white/10 dark:bg-[#0d0e11]"
            >
                <div className="mx-auto max-w-6xl">
                    <Reveal className="mx-auto max-w-2xl text-center">
                        <Eyebrow>{copy.workflow.eyebrow}</Eyebrow>
                        <h2 className="home-heading">{copy.workflow.title}</h2>
                        <p className="home-body mt-5">
                            {copy.workflow.description}
                        </p>
                    </Reveal>
                    <div
                        ref={workflowTrack}
                        className="home-workflow-track mt-12"
                    >
                        <div
                            ref={workflowStage}
                            className="home-workflow-stage"
                        >
                            <div className="flex h-full flex-col">
                                <div
                                    id="workflow-label"
                                    className="mx-auto flex w-full max-w-3xl items-center gap-4"
                                    aria-live="polite"
                                    aria-atomic="true"
                                >
                                    <span className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 font-mono text-sm text-amber-800 dark:text-amber-300">
                                        0{currentStep + 1}
                                        <span className="mx-2 text-zinc-400">
                                            /
                                        </span>
                                        03
                                    </span>
                                    <span className="text-lg font-semibold tracking-tight sm:text-xl">
                                        {copy.workflow.steps[currentStep].short}
                                    </span>
                                </div>
                                <div
                                    aria-hidden
                                    className="relative mx-auto mt-3 h-0.5 w-full max-w-3xl rounded-full bg-zinc-200 dark:bg-white/10"
                                >
                                    <motion.div
                                        className="h-full origin-left rounded-full bg-amber-600 dark:bg-amber-400"
                                        style={{ scaleX: workflowProgress }}
                                    />
                                    {/* Position runs from 0 to 2; rounding switches steps at 0.5 and 1.5. */}
                                    {[25, 75].map((boundary) => (
                                        <span
                                            key={boundary}
                                            className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-zinc-400 dark:bg-zinc-500"
                                            style={{ left: `${boundary}%` }}
                                        />
                                    ))}
                                </div>
                                <div
                                    id="workflow-content"
                                    role="region"
                                    aria-labelledby="workflow-label"
                                    tabIndex={0}
                                    className="home-workflow-content relative mt-6 min-h-0 flex-1 outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                                >
                                    {workflowKeys.map((key, index) => {
                                        const step = copy.workflow.steps[index]
                                        return (
                                            <WorkflowLayer
                                                key={key}
                                                active={workflow === key}
                                            >
                                                <div className="home-workflow-copy">
                                                    <h3 className="text-2xl font-semibold tracking-[-.035em] sm:text-3xl">
                                                        {step.title}
                                                    </h3>
                                                    <p className="home-body mt-4">
                                                        {step.text}
                                                    </p>
                                                    <Points
                                                        items={step.bullets}
                                                    />
                                                </div>
                                                <div className="home-workflow-visual min-h-0 min-w-0 rounded-2xl border border-zinc-200 bg-zinc-100/70 p-2 shadow-sm dark:border-white/10 dark:bg-[#17181c]">
                                                    {key === "signups" ? (
                                                        <div className="home-workflow-discord flex flex-col overflow-hidden rounded-xl bg-[#313338] p-4 sm:p-6">
                                                            <div className="mb-4 flex items-center gap-2 text-xs text-zinc-400">
                                                                <span className="text-lg">
                                                                    #
                                                                </span>
                                                                {
                                                                    copy
                                                                        .workflow
                                                                        .channel
                                                                }
                                                            </div>
                                                            <LandingDiscordPreview
                                                                kind="announcement"
                                                                fit
                                                                locale={locale}
                                                                dictionary={
                                                                    dictionary
                                                                }
                                                            />
                                                            <p className="mt-4 text-[10px] text-zinc-400">
                                                                {
                                                                    copy
                                                                        .workflow
                                                                        .example
                                                                }
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <ProductShot
                                                            shot={
                                                                key === "plan"
                                                                    ? "event"
                                                                    : "roster"
                                                            }
                                                            title={
                                                                key === "plan"
                                                                    ? copy
                                                                          .screens
                                                                          .event
                                                                    : copy
                                                                          .screens
                                                                          .roster
                                                            }
                                                            zoomLabel={
                                                                copy.screens
                                                                    .zoom
                                                            }
                                                            onOpen={setViewer}
                                                        />
                                                    )}
                                                </div>
                                            </WorkflowLayer>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="home-section mx-auto max-w-6xl px-5 py-24 sm:px-8 lg:py-32">
                <Reveal className="grid items-center gap-10 lg:grid-cols-[1.3fr_1fr] lg:gap-16">
                    <div className="relative order-2 min-w-0 lg:order-1">
                        <div
                            aria-hidden
                            className="absolute inset-0 rounded-full bg-amber-500/5 blur-3xl"
                        />
                        <div className="relative rounded-2xl border border-zinc-200 bg-zinc-100 p-3 sm:p-6 dark:border-white/10 dark:bg-[#15161b]">
                            <LandingDiscordPreview
                                kind="reminder"
                                locale={locale}
                                dictionary={dictionary}
                            />
                            <p className="mt-3 px-1 text-[10px] leading-5 text-zinc-500">
                                {copy.discord.note}
                            </p>
                        </div>
                    </div>
                    <div className="order-1 lg:order-2">
                        <Eyebrow>{copy.discord.eyebrow}</Eyebrow>
                        <h2 className="home-heading">{copy.discord.title}</h2>
                        <p className="home-body mt-5">
                            {copy.discord.description}
                        </p>
                        <div className="mt-9 border-t border-zinc-200 pt-7 dark:border-white/10">
                            <h3 className="text-lg font-semibold tracking-tight">
                                {copy.roster.title}
                            </h3>
                            <p className="home-body mt-3 text-sm">
                                {copy.roster.description}
                            </p>
                            <div className="mt-5">
                                <TextLink href="/wiki/operations/rosters">
                                    {copy.roster.guide}
                                </TextLink>
                            </div>
                        </div>
                    </div>
                </Reveal>
            </section>

            <section className="home-section border-y border-zinc-200 bg-white px-5 py-24 sm:px-8 lg:py-28 dark:border-white/10 dark:bg-[#0d0e11]">
                <div className="mx-auto max-w-6xl">
                    <Reveal className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:gap-20">
                        <div>
                            <Eyebrow>{copy.performance.eyebrow}</Eyebrow>
                            <h2 className="home-heading">
                                {copy.performance.title}
                            </h2>
                        </div>
                        <div>
                            <p className="home-body">
                                {copy.performance.description}
                            </p>
                            <Points items={copy.performance.points} />
                            <div className="mt-6">
                                <TextLink href="/wiki/public/matches-and-competitions">
                                    {copy.performance.guide}
                                </TextLink>
                            </div>
                        </div>
                    </Reveal>
                    <Reveal className="mt-12 rounded-2xl border border-zinc-200 bg-zinc-100/70 p-2 sm:p-4 dark:border-white/10 dark:bg-[#17181c]">
                        <ProductShot
                            shot="performance"
                            title={copy.screens.performance}
                            zoomLabel={copy.screens.zoom}
                            onOpen={setViewer}
                        />
                    </Reveal>
                </div>
            </section>

            <section
                id="features"
                className="home-section mx-auto max-w-6xl px-5 py-24 sm:px-8 lg:py-32"
            >
                <Reveal className="max-w-2xl">
                    <Eyebrow>{copy.explore.eyebrow}</Eyebrow>
                    <h2 className="home-heading">{copy.explore.title}</h2>
                    <p className="home-body mt-5">{copy.explore.description}</p>
                </Reveal>
                <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {renderFeature(0)}
                    <div className="space-y-4 md:col-span-2 lg:col-span-1">
                        {renderFeature(1)}
                        {renderFeature(2)}
                        {renderFeature(6)}
                    </div>
                    {[3, 4, 5].map(renderFeature)}
                </div>
                <div className="mt-8">
                    <TextLink href="/wiki">{copy.explore.guide}</TextLink>
                </div>
            </section>

            <section className="home-section relative isolate overflow-hidden border-y border-zinc-200 bg-zinc-100 px-5 py-20 sm:px-8 lg:py-24 dark:border-white/10 dark:bg-[#101114]">
                <div
                    aria-hidden
                    className="absolute -top-32 -right-24 -z-10 size-[550px] rounded-full bg-[radial-gradient(ellipse,#e8a33d14,transparent_70%)]"
                />
                <Reveal className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
                    <div>
                        <Eyebrow>{copy.ownership.eyebrow}</Eyebrow>
                        <h2 className="home-heading">{copy.ownership.title}</h2>
                        <p className="home-body mt-5 max-w-xl">
                            {copy.ownership.description}
                        </p>
                    </div>
                    <div className="overflow-hidden rounded-2xl border border-zinc-300/80 bg-white/80 dark:border-white/10 dark:bg-white/[.025]">
                        {[
                            {
                                icon: Github,
                                title: copy.ownership.source,
                                detail: "github.com/Ninjonik/logi",
                                href: "https://github.com/Ninjonik/logi",
                            },
                            {
                                icon: Code2,
                                title: copy.ownership.contribute,
                                detail: "CONTRIBUTING.md",
                                href: "https://github.com/Ninjonik/logi/blob/main/CONTRIBUTING.md",
                            },
                            {
                                icon: Server,
                                title: copy.ownership.host,
                                detail: "Dashboard · Convex · Discord",
                                href: "https://github.com/Ninjonik/logi/blob/main/docs/self-hosting.md",
                            },
                        ].map(({ icon: Icon, title, detail, href }) => (
                            <a
                                key={href}
                                href={href}
                                className="flex items-center gap-4 border-b border-zinc-200 px-5 py-5 transition-colors last:border-0 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-amber-500 dark:border-white/10 dark:hover:bg-white/5"
                            >
                                <Icon className="size-5 shrink-0 text-zinc-500" />
                                <span className="flex-1">
                                    <span className="block text-sm font-medium">
                                        {title}
                                    </span>
                                    <span className="mt-1 block text-[11px] text-zinc-500">
                                        {detail}
                                    </span>
                                </span>
                                <ExternalLink className="size-3.5 text-zinc-400" />
                            </a>
                        ))}
                    </div>
                </Reveal>
            </section>

            <section className="home-section mx-auto max-w-3xl px-5 py-24 sm:px-8 lg:py-28">
                <Reveal>
                    <h2 className="home-heading mb-10 text-center">
                        {copy.faq.title}
                    </h2>
                    <div className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-white/10 dark:border-white/10">
                        {copy.faq.items.map((item) => (
                            <details key={item.question} className="group">
                                <summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-5 text-sm font-medium [&::-webkit-details-marker]:hidden">
                                    {item.question}
                                    <ChevronDown className="size-4 shrink-0 text-zinc-500 transition-transform group-open:rotate-180" />
                                </summary>
                                <p className="home-body pb-6 text-sm">
                                    {item.answer}
                                </p>
                            </details>
                        ))}
                    </div>
                </Reveal>
            </section>

            {logicommsDownloadUrl ? (
                <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-8">
                    <div className="flex flex-col gap-5 rounded-2xl border border-zinc-200 p-6 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
                        <div className="flex items-start gap-4">
                            <Radio className="mt-1 size-5 shrink-0 text-zinc-500" />
                            <div>
                                <h2 className="text-base font-semibold">
                                    {copy.comms.title}
                                </h2>
                                <p className="home-body mt-2 max-w-xl text-sm">
                                    {copy.comms.description}
                                </p>
                            </div>
                        </div>
                        <Button asChild variant="outline" className="shrink-0">
                            <a href={logicommsDownloadUrl}>
                                {copy.comms.download}
                                <Download className="size-4" />
                            </a>
                        </Button>
                    </div>
                </section>
            ) : null}

            <section className="relative overflow-hidden border-t border-zinc-200 px-5 py-24 text-center sm:px-8 lg:py-32 dark:border-white/10">
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,#e8a33d15,transparent_65%)]"
                />
                <Reveal className="relative mx-auto max-w-3xl">
                    <Swords className="mx-auto mb-7 size-8 text-amber-700 dark:text-amber-400" />
                    <h2 className="home-heading">{copy.closing.title}</h2>
                    <p className="home-body mx-auto mt-5 max-w-lg">
                        {copy.closing.description}
                    </p>
                    <div className="mt-8 flex flex-wrap justify-center gap-3">
                        <Button
                            asChild
                            size="lg"
                            className="h-12 rounded-xl px-6"
                        >
                            <Link href={action}>
                                {copy.closing.action}
                                <ArrowRight className="size-4" />
                            </Link>
                        </Button>
                        <Button
                            asChild
                            variant="outline"
                            size="lg"
                            className="h-12 rounded-xl"
                        >
                            <Link href="/wiki/getting-started">
                                <BookOpen className="size-4" />
                                {copy.setup.guide}
                            </Link>
                        </Button>
                    </div>
                </Reveal>
            </section>

            <Dialog
                open={Boolean(viewer)}
                onOpenChange={(open) => {
                    if (!open) setViewer(null)
                }}
            >
                <DialogContent
                    showCloseButton={false}
                    className="max-h-[94dvh] w-[96vw] max-w-[1440px] gap-0 overflow-y-auto rounded-2xl p-0 sm:max-w-[1440px]"
                >
                    <DialogHeader className="flex-row items-center justify-between gap-4 border-b px-5 py-3">
                        <div>
                            <DialogTitle className="text-sm font-medium">
                                {viewer?.title}
                            </DialogTitle>
                            <DialogDescription className="sr-only">
                                {copy.screens.caption}
                            </DialogDescription>
                        </div>
                        <DialogClose asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label={copy.screens.close}
                            >
                                <X className="size-4" />
                            </Button>
                        </DialogClose>
                    </DialogHeader>
                    {viewer ? (
                        <Image
                            src={viewer.src}
                            alt={viewer.title}
                            width={viewer.width}
                            height={viewer.height}
                            quality={90}
                            sizes="100vw"
                            className="h-auto w-full"
                        />
                    ) : null}
                </DialogContent>
            </Dialog>
        </main>
    )
}
