"use client"

import {
    ArrowRight,
    CalendarDays,
    Check,
    ClipboardList,
    Code2,
    Crosshair,
    Database,
    LayoutDashboard,
    Medal,
    Radio,
    ShieldCheck,
    Sparkles,
    Swords,
    UsersRound,
} from "lucide-react"
import {
    motion,
    useMotionValue,
    useReducedMotion,
    useScroll,
    useSpring,
    useTransform,
} from "framer-motion"
import type { getDictionary } from "@/i18n/dictionaries"
import { useRef } from "react"
import Link from "next/link"

type Dictionary = ReturnType<typeof getDictionary>
type Props = {
    dictionary: Dictionary
    locale: string
    signedIn: boolean
    userName?: string
}
const visuals = [
    [LayoutDashboard, "dashboard", "dashboard"],
    [CalendarDays, "calendar", "calendar"],
    [UsersRound, "roster", "roster"],
    [Swords, "briefing", "briefing"],
    [Medal, "matches", "matches"],
    [ShieldCheck, "members", "members"],
    [CalendarDays, "event", "event"],
    [Crosshair, "presets", "presets"],
    [ClipboardList, "assignments", "assignments"],
    [Medal, "matchData", "match-data"],
    [Code2, "api", "api"],
] as const

export function LandingPage({ dictionary, locale, signedIn, userName }: Props) {
    const reduce = useReducedMotion(),
        landing = dictionary.home.landing,
        action = `/${locale}/${signedIn ? "dashboard" : "login"}`,
        hero = useRef<HTMLElement>(null)
    const { scrollYProgress } = useScroll({
            target: hero,
            offset: ["start start", "end start"],
        }),
        deckY = useTransform(scrollYProgress, [0, 1], [0, 190])
    return (
        <main className="landing-page flex-1 overflow-hidden bg-[#faf9f6] text-zinc-950 dark:bg-[#050505] dark:text-white">
            <section
                ref={hero}
                className="relative min-h-[920px] overflow-hidden border-b border-zinc-200 dark:border-white/10"
            >
                <Aurora />
                <div className="relative mx-auto max-w-7xl px-4 pt-20 sm:px-6 lg:px-8 lg:pt-28">
                    <motion.div
                        initial={reduce ? false : { opacity: 0, y: 26 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                        className="mx-auto max-w-5xl text-center"
                    >
                        <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-4 py-2 text-xs font-bold tracking-[.18em] text-amber-200 uppercase">
                            <span className="relative flex size-2">
                                <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-300 opacity-75" />
                                <span className="relative inline-flex size-2 rounded-full bg-amber-300" />
                            </span>
                            {landing.heroEyebrow}
                        </div>
                        <h1 className="mt-8 text-5xl font-semibold tracking-[-.065em] text-balance sm:text-7xl lg:text-[6.6rem] lg:leading-[.9]">
                            {landing.heroLineOne}
                            <br />
                            <span className="landing-gradient-text">
                                {landing.heroLineAccent}
                            </span>
                            <br />
                            {landing.heroLineThree}
                        </h1>
                        <p className="mx-auto mt-8 max-w-2xl text-base leading-7 text-pretty text-zinc-600 sm:text-lg dark:text-white/60">
                            {landing.heroDescription}
                        </p>
                        <div className="mt-9 flex flex-wrap justify-center gap-3">
                            <MovingButton href={action}>
                                {signedIn
                                    ? dictionary.home.dashboard
                                    : landing.deployCommunity}
                                <ArrowRight className="size-4" />
                            </MovingButton>
                            <a
                                href="#arsenal"
                                className="inline-flex h-12 items-center gap-2 rounded-xl border border-zinc-300 bg-white/70 px-5 text-sm font-semibold text-zinc-800 backdrop-blur hover:bg-white dark:border-white/15 dark:bg-white/5 dark:text-white/90 dark:hover:bg-white/10"
                            >
                                {landing.seeEverything}
                                <ArrowRight className="size-4" />
                            </a>
                        </div>
                    </motion.div>
                    <motion.div
                        style={reduce ? undefined : { y: deckY }}
                        className="relative mx-auto mt-20 h-[470px] max-w-6xl sm:h-[610px]"
                    >
                        <Deck
                            className="absolute top-24 left-[3%] w-[58%] -rotate-[8deg] opacity-50"
                            light="calendar"
                            title={landing.features.calendar.title}
                        />
                        <Deck
                            className="absolute top-20 right-[3%] w-[58%] rotate-[8deg] opacity-50"
                            light="roster"
                            title={landing.features.roster.title}
                        />
                        <motion.div
                            initial={
                                reduce
                                    ? false
                                    : { opacity: 0, y: 90, rotateX: 16 }
                            }
                            animate={{ opacity: 1, y: 0, rotateX: 0 }}
                            transition={{
                                duration: 1.1,
                                delay: 0.22,
                                ease: [0.16, 1, 0.3, 1],
                            }}
                            className="absolute inset-x-[5%] top-0 [perspective:1000px] sm:inset-x-[9%]"
                        >
                            <Deck
                                light="dashboard"
                                title={landing.features.dashboard.title}
                                priority
                            />
                            <FloatingSignal text={landing.playersConfirmed} />
                        </motion.div>
                    </motion.div>
                </div>
            </section>
            <div className="border-y border-zinc-200 bg-white py-5 dark:border-white/10 dark:bg-zinc-950">
                <Marquee items={landing.marquee} />
            </div>
            <section
                id="arsenal"
                className="relative mx-auto max-w-7xl px-6 py-28 sm:px-8 lg:px-12"
            >
                <Beam />
                <Heading
                    eyebrow={landing.arsenalEyebrow}
                    title={landing.arsenalTitle}
                    body={landing.arsenalDescription}
                />
                <div className="mt-16 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {visuals.map(([Icon, key, image], i) => (
                        <Spotlight
                            key={key}
                            title={landing.features[key].title}
                            text={landing.features[key].description}
                            icon={Icon}
                            image={image}
                            index={i}
                        />
                    ))}
                </div>
            </section>
            <section className="relative border-y border-zinc-200 bg-zinc-100 px-4 py-28 sm:px-6 lg:px-8 dark:border-white/10 dark:bg-[#0d0d0e]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(245,158,11,.2),transparent_42%)]" />
                <div className="relative mx-auto max-w-6xl">
                    <Heading
                        eyebrow={landing.workflowEyebrow}
                        title={landing.workflowTitle}
                        body={landing.workflowDescription}
                    />
                    <div className="mt-16 grid gap-5 md:grid-cols-4">
                        {landing.workflow.map(({ title, description }, i) => (
                            <motion.div
                                key={title}
                                initial={reduce ? false : { opacity: 0, y: 25 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.12 }}
                                className="relative rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[.035] dark:shadow-none"
                            >
                                <span className="text-5xl font-semibold tracking-[-.08em] text-amber-300/20">
                                    {String(i + 1).padStart(2, "0")}
                                </span>
                                <h3 className="mt-10 text-xl font-semibold">
                                    {title}
                                </h3>
                                <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-white/50">
                                    {description}
                                </p>
                                {i < 3 && (
                                    <span className="absolute top-1/2 -right-4 hidden size-8 items-center justify-center rounded-full border border-amber-300/30 bg-white text-amber-700 shadow-sm md:flex dark:bg-zinc-950 dark:text-amber-200">
                                        <ArrowRight className="size-4" />
                                    </span>
                                )}
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>
            <section className="relative mx-auto max-w-7xl px-4 py-28 sm:px-6 lg:px-8">
                <Beam />
                <Heading
                    eyebrow={landing.ownershipEyebrow}
                    title={landing.ownershipTitle}
                    body={landing.ownershipDescription}
                />
                <div className="mt-16 grid gap-4 md:grid-cols-3">
                    <Value icon={Sparkles} {...landing.values.hosted} />
                    <Value icon={Database} {...landing.values.selfHosted} />
                    <Value icon={Code2} {...landing.values.openSource} />
                </div>
            </section>
            <section className="relative overflow-hidden px-4 py-32 sm:px-6 lg:px-8">
                <Aurora />
                <div className="relative mx-auto max-w-4xl text-center">
                    <Radio className="mx-auto size-7 text-amber-300" />
                    <h2 className="mt-6 text-5xl font-semibold tracking-[-.06em] text-balance sm:text-7xl">
                        {landing.finalTitle}
                    </h2>
                    <p className="mx-auto mt-6 max-w-xl text-lg text-zinc-600 dark:text-white/60">
                        {landing.finalDescription}
                    </p>
                    <MovingButton href={action} className="mt-9">
                        {signedIn
                            ? dictionary.home.dashboard
                            : dictionary.home.openApp}
                        <Sparkles className="size-4" />
                    </MovingButton>
                </div>
            </section>
        </main>
    )
}
function Heading({
    eyebrow,
    title,
    body,
}: {
    eyebrow: string
    title: string
    body: string
}) {
    return (
        <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-bold tracking-[.25em] text-amber-300 uppercase">
                {eyebrow}
            </p>
            <h2 className="mt-5 text-4xl font-semibold tracking-[-.055em] text-balance sm:text-6xl">
                {title}
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-pretty text-zinc-600 sm:text-lg dark:text-white/55">
                {body}
            </p>
        </div>
    )
}
function Deck({
    light,
    title,
    className = "",
    priority = false,
    crop = false,
    flush = false,
}: {
    light: string
    title: string
    className?: string
    priority?: boolean
    crop?: boolean
    flush?: boolean
}) {
    return (
        <div
            className={`overflow-hidden ${flush ? "rounded-t-2xl" : "rounded-2xl border border-zinc-300 bg-zinc-200 p-1 shadow-[0_35px_100px_-24px_rgba(0,0,0,.25)] dark:border-white/20 dark:bg-zinc-800 dark:shadow-[0_35px_100px_-24px_rgba(0,0,0,.8)]"} ${className}`}
        >
            <img
                src={`/images/product/${light}-light.png`}
                alt={title}
                className={`block w-full ${flush ? "rounded-t-2xl" : "rounded-xl"} dark:hidden ${crop ? "h-full object-cover object-top" : ""}`}
                fetchPriority={priority ? "high" : "auto"}
            />
            <img
                src={`/images/product/${light}-dark.png`}
                alt=""
                className={`hidden w-full ${flush ? "rounded-t-2xl" : "rounded-xl"} dark:block ${crop ? "h-full object-cover object-top" : ""}`}
                fetchPriority={priority ? "high" : "auto"}
            />
        </div>
    )
}
function Spotlight({
    title,
    text,
    icon: Icon,
    image,
    index,
}: {
    title: string
    text: string
    icon: typeof CalendarDays
    image: string
    index: number
}) {
    const ref = useRef<HTMLDivElement>(null),
        x = useMotionValue(0),
        y = useMotionValue(0),
        rx = useSpring(useTransform(y, [-0.5, 0.5], [7, -7]), {
            stiffness: 130,
            damping: 18,
        }),
        ry = useSpring(useTransform(x, [-0.5, 0.5], [-7, 7]), {
            stiffness: 130,
            damping: 18,
        })
    return (
        <motion.article
            ref={ref}
            onPointerMove={(e) => {
                const r = ref.current?.getBoundingClientRect()
                if (r) {
                    x.set((e.clientX - r.left) / r.width - 0.5)
                    y.set((e.clientY - r.top) / r.height - 0.5)
                }
            }}
            onPointerLeave={() => {
                x.set(0)
                y.set(0)
            }}
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ delay: (index % 3) * 0.08, duration: 0.6 }}
            style={{ rotateX: rx, rotateY: ry, transformPerspective: 1000 }}
            className="group relative min-h-[540px] overflow-hidden rounded-t-[1.75rem] bg-white p-6 [transform-style:preserve-3d] dark:bg-white/[.035]"
        >
            <div className="relative z-10">
                <div className="flex size-11 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-300/10 text-amber-200">
                    <Icon className="size-5" />
                </div>
                <h3 className="mt-5 text-xl font-semibold tracking-[-.03em]">
                    {title}
                </h3>
                <p className="mt-2 max-w-xs text-sm leading-6 text-zinc-600 dark:text-white/55">
                    {text}
                </p>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-[205px] transition-transform duration-500 group-hover:-translate-y-1">
                <Deck
                    light={image}
                    title={title}
                    crop
                    flush
                    className="h-full"
                />
            </div>
        </motion.article>
    )
}
function Value({
    icon: Icon,
    title,
    description,
}: {
    icon: typeof Sparkles
    title: string
    description: string
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            whileHover={{ y: -6 }}
            className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-b from-white to-amber-50 p-7 shadow-sm dark:border-white/10 dark:from-white/[.07] dark:to-white/[.02] dark:shadow-none"
        >
            <div className="absolute -top-12 -right-12 size-36 rounded-full bg-amber-300/10 blur-2xl transition-transform duration-500 group-hover:scale-150" />
            <Icon className="relative size-6 text-amber-200" />
            <h3 className="relative mt-10 text-xl font-semibold tracking-[-.035em]">
                {title}
            </h3>
            <p className="relative mt-3 text-sm leading-6 text-zinc-600 dark:text-white/55">
                {description}
            </p>
        </motion.div>
    )
}
function MovingButton({
    href,
    children,
    className = "",
}: {
    href: string
    children: React.ReactNode
    className?: string
}) {
    return (
        <Link
            href={href}
            className={`landing-moving-border inline-flex h-12 items-center gap-2 rounded-xl p-px text-sm font-semibold ${className}`}
        >
            <span className="relative flex h-full items-center gap-2 rounded-[11px] bg-white px-5 text-zinc-950">
                {children}
            </span>
        </Link>
    )
}
function FloatingSignal({ text }: { text: string }) {
    return (
        <motion.div
            animate={{ y: [0, -9, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-[22%] -right-5 hidden rounded-2xl border border-zinc-200 bg-white/85 p-3 text-zinc-950 shadow-2xl backdrop-blur-xl lg:block dark:border-white/20 dark:bg-zinc-900/80 dark:text-white"
        >
            <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300">
                    <Check className="size-5" />
                </span>
                <span className="text-sm font-semibold">{text}</span>
            </div>
        </motion.div>
    )
}
function Marquee({ items }: { items: readonly string[] }) {
    return (
        <div className="overflow-hidden">
            <div className="landing-marquee-track flex w-max text-xs font-bold tracking-[.28em] whitespace-nowrap text-zinc-500 dark:text-white/55">
                {[0, 1].map((copy) => (
                    <div key={copy} className="flex shrink-0 gap-10 pr-10">
                        {items.map((item) => (
                            <span
                                key={`${copy}-${item}`}
                                className="flex items-center gap-10"
                            >
                                {item}
                                <span className="size-1 rounded-full bg-amber-300" />
                            </span>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    )
}
function Beam() {
    return (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden bg-zinc-200 dark:bg-white/10">
            <span className="absolute inset-y-0 w-1/4 animate-[beam_4s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-amber-300 to-transparent blur-[1px]" />
        </div>
    )
}
function Aurora() {
    return (
        <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden"
        >
            <div className="absolute -top-64 left-1/2 size-[60rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(251,191,36,.28),rgba(249,115,22,.12)_30%,transparent_68%)] blur-3xl" />
            <div className="absolute inset-x-0 top-0 h-[44rem] bg-[linear-gradient(to_right,transparent_0%,rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(to_bottom,transparent_0%,rgba(255,255,255,.06)_1px,transparent_1px)] [mask-image:linear-gradient(to_bottom,black,transparent)] bg-[size:64px_64px]" />
        </div>
    )
}
