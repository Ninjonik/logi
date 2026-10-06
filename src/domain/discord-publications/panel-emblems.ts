/**
 * The fixed sign set of the server panels (P7/P8): Logi's own Hell Let Loose
 * nation emblems, the Wardogs faction icons, the four status icons and the
 * three player-gauge pieces. They are the same everywhere: the bot uploads
 * them once as application emoji and the score image draws the same shapes.
 * Nothing here is configurable per clan.
 */

/** Hell Let Loose nations Logi draws, plus the generic side signs. */
export const HLL_NATIONS = [
    "us",
    "gb",
    "sov",
    "cw",
    "ger",
    "dak",
    "allies",
    "axis",
] as const
export type HllNation = (typeof HLL_NATIONS)[number]
export type HllSide = "allies" | "axis"
export const HLL_NATION_SIDE: Record<HllNation, HllSide> = {
    us: "allies",
    gb: "allies",
    sov: "allies",
    cw: "allies",
    ger: "axis",
    dak: "axis",
    allies: "allies",
    axis: "axis",
}
export function isHllNation(value: unknown): value is HllNation {
    return (
        typeof value === "string" &&
        (HLL_NATIONS as readonly string[]).includes(value)
    )
}

/** Wardogs factions and the game sign; the icons are the MIT-licensed Wardogs assets. */
export const WARDOGS_SIGNS = [
    "valkyra",
    "manticore",
    "lonestar",
    "wardogs",
] as const
export type WardogsSign = (typeof WARDOGS_SIGNS)[number]
export type WardogsFaction = Exclude<WardogsSign, "wardogs">
export const WARDOGS_FACTIONS = [
    "valkyra",
    "manticore",
    "lonestar",
] as const satisfies readonly WardogsFaction[]
export function isWardogsFaction(value: unknown): value is WardogsFaction {
    return (
        typeof value === "string" &&
        (WARDOGS_FACTIONS as readonly string[]).includes(value)
    )
}
/** Packaged icon of a Wardogs sign, relative to `public/`. */
export function wardogsSignPath(sign: WardogsSign) {
    return `/stratmap/icons/wardogs/${sign}.webp`
}

export const PANEL_SERVER_STATES = [
    "live",
    "seeding",
    "empty",
    "offline",
] as const
export type PanelServerState = (typeof PANEL_SERVER_STATES)[number]
export const PLAYER_GAUGE_PIECES = ["players", "queue", "free"] as const
export type PlayerGaugePiece = (typeof PLAYER_GAUGE_PIECES)[number]

/** State colours shared by chips, icons and the gauge. */
export const PANEL_STATE_COLORS: Record<PanelServerState, string> = {
    live: "#3ba55c",
    seeding: "#f0b232",
    empty: "#80848e",
    offline: "#ed4245",
}
export const PLAYER_GAUGE_COLORS: Record<PlayerGaugePiece, string> = {
    players: "#3ba55c",
    queue: "#f0b232",
    free: "#4e5058",
}
/** Sector colours of the Hell Let Loose sector bar. */
export const HLL_SIDE_COLORS: Record<HllSide, string> = {
    allies: "#5b8def",
    axis: "#d9534f",
}

const STAR =
    "M12 4.2l2.1 4.8 5.2.4-3.9 3.4 1.2 5.1L12 15.2l-4.6 2.7 1.2-5.1-3.9-3.4 5.2-.4z"
const CROSS_OUTER = "M9.2 4.5h5.6v4.7h4.7v5.6h-4.7v4.7H9.2v-4.7H4.5V9.2h4.7z"
const CROSS_INNER = "M10.4 5.7h3.2v4.7h4.7v3.2h-4.7v4.7h-3.2v-4.7H5.7v-3.2h4.7z"
const svg = (body: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="128" height="128">${body}</svg>`
const disc = (fill: string) => `<circle cx="12" cy="12" r="11" fill="${fill}"/>`
const ironCross = (fill: string) =>
    svg(
        `${disc(fill)}<path d="${CROSS_OUTER}" fill="#ffffff"/><path d="${CROSS_INNER}" fill="#111111"/>`
    )

/** Simple, clean emblems drawn by Logi; not game artwork. */
export const HLL_NATION_SVG: Record<HllNation, string> = {
    us: svg(`${disc("#55642f")}<path d="${STAR}" fill="#ffffff"/>`),
    gb: svg(
        `${disc("#1f3d8a")}<circle cx="12" cy="12" r="7.4" fill="#ffffff"/><circle cx="12" cy="12" r="4" fill="#c8102e"/>`
    ),
    sov: svg(
        `${disc("#3a3a2c")}<path d="${STAR}" fill="#d42a1f" stroke="#f4c430" stroke-width="0.8"/>`
    ),
    cw: svg(
        `${disc("#f4efe6")}<path d="M12 3.2l1.5 3.4 2-1 -.4 3.6 2.9-1.6-.5 3 2.6.5-3 2.6 1 1.6-5-.5-.4 4.6h-1.4l-.4-4.6-5 .5 1-1.6-3-2.6 2.6-.5-.5-3 2.9 1.6-.4-3.6 2 1z" fill="#c8102e"/>`
    ),
    ger: ironCross("#4a4f57"),
    dak: ironCross("#c9a96b"),
    allies: svg(`${disc("#2f4f8f")}<path d="${STAR}" fill="#ffffff"/>`),
    axis: svg(
        `${disc("#7a2e2e")}<path d="M10 5h4v5h5v4h-5v5h-4v-5H5v-4h5z" fill="#ffffff"/>`
    ),
}

/** Status icons: always shown next to a word, never alone. */
export const PANEL_STATE_SVG: Record<PanelServerState, string> = {
    live: svg(
        `${disc("#1f3a2a")}<circle cx="12" cy="12" r="7.5" fill="none" stroke="#3ba55c" stroke-width="2"/><circle cx="12" cy="12" r="3.5" fill="#3ba55c"/>`
    ),
    seeding: svg(
        `${disc("#3d3214")}<circle cx="12" cy="12" r="7" fill="none" stroke="#f0b232" stroke-width="2"/><path d="M12 12V5a7 7 0 0 1 6.06 10.5z" fill="#f0b232"/>`
    ),
    empty: svg(
        `<circle cx="12" cy="12" r="10.5" fill="#2b2d31" stroke="#80848e" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="#80848e"/>`
    ),
    offline: svg(
        `${disc("#ed4245")}<path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round"/>`
    ),
}

/** One gauge piece; ten in a row form the capacity bar, the queue sits after a gap. */
export const PLAYER_GAUGE_SVG: Record<PlayerGaugePiece, string> = {
    players: svg(
        `<rect x="1" y="6" width="22" height="12" rx="3.5" fill="${PLAYER_GAUGE_COLORS.players}"/>`
    ),
    queue: svg(
        `<rect x="1" y="6" width="22" height="12" rx="3.5" fill="${PLAYER_GAUGE_COLORS.queue}"/>`
    ),
    free: svg(
        `<rect x="1" y="6" width="22" height="12" rx="3.5" fill="${PLAYER_GAUGE_COLORS.free}"/>`
    ),
}

export type PanelEmojiGroup = "faction" | "status"
export type PanelEmojiKey =
    HllNation | WardogsSign | PanelServerState | `gauge_${PlayerGaugePiece}`
export type PanelEmojiSource =
    { kind: "svg"; svg: string } | { kind: "file"; path: string }
export type PanelEmojiDefinition = {
    key: PanelEmojiKey
    group: PanelEmojiGroup
    source: PanelEmojiSource
}

/**
 * The application emoji the bot provisions: 12 faction/nation signs and 7
 * status/gauge pieces. Order is the display order on the settings page.
 */
export const PANEL_EMOJI: readonly PanelEmojiDefinition[] = [
    ...HLL_NATIONS.map((nation) => ({
        key: nation,
        group: "faction" as const,
        source: { kind: "svg" as const, svg: HLL_NATION_SVG[nation] },
    })),
    ...WARDOGS_SIGNS.map((sign) => ({
        key: sign,
        group: "faction" as const,
        source: { kind: "file" as const, path: wardogsSignPath(sign) },
    })),
    ...PANEL_SERVER_STATES.map((state) => ({
        key: state,
        group: "status" as const,
        source: { kind: "svg" as const, svg: PANEL_STATE_SVG[state] },
    })),
    ...PLAYER_GAUGE_PIECES.map((piece) => ({
        key: `gauge_${piece}` as const,
        group: "status" as const,
        source: { kind: "svg" as const, svg: PLAYER_GAUGE_SVG[piece] },
    })),
]
export const PANEL_EMOJI_GROUP_SIZE: Record<PanelEmojiGroup, number> = {
    faction: PANEL_EMOJI.filter((emoji) => emoji.group === "faction").length,
    status: PANEL_EMOJI.filter((emoji) => emoji.group === "status").length,
}

/**
 * Application emoji name: `logi_<key>_<digest>`. The digest changes with the
 * artwork, so a redrawn icon is uploaded as a new emoji instead of silently
 * reusing the old one. Discord allows 2–32 characters of [A-Za-z0-9_].
 */
export function panelEmojiName(key: PanelEmojiKey, digest: string): string {
    const name = `logi_${key}_${digest
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 8)}`
    if (!/^[A-Za-z0-9_]{2,32}$/.test(name))
        throw new Error("Invalid application emoji name.")
    return name
}
