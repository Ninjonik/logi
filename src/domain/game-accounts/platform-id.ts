/**
 * Game account IDs a member declares with `/link` (boards L4 1.5 and M3
 * 1.2): Steam, Epic Games, Xbox and PlayStation. Each platform's ID is
 * checked before it is stored, so "Hráč 17" or a pasted link never lands in
 * the profile (M3-B08). A declared ID is a claim, not proof of ownership;
 * proof of a Steam account is the separate web flow (Můj účet).
 *
 * Stored values keep the existing `platform:id` form (`steam:7656119…`),
 * which the rest of Logi already reads.
 */

export const GAME_ACCOUNT_PLATFORMS = [
    "steam",
    "epic",
    "xbox",
    "playstation",
] as const
export type GameAccountPlatform = (typeof GAME_ACCOUNT_PLATFORMS)[number]

export function isGameAccountPlatform(
    value: string | null | undefined
): value is GameAccountPlatform {
    return (GAME_ACCOUNT_PLATFORMS as readonly string[]).includes(value ?? "")
}

/** Steam64 of a person: 17 digits that start 7656119 (L4-B07). */
const STEAM64 = /^7656119\d{10}$/
/** Epic Account ID: 32 hexadecimal characters. */
const EPIC_ACCOUNT_ID = /^[0-9a-f]{32}$/i
/** Xbox gamertag: starts with a letter, letters, digits and single spaces, an optional #1234 suffix. */
const XBOX_GAMERTAG = /^[A-Za-z](?:[A-Za-z0-9]| (?! )){0,14}(?:#\d{1,4})?$/
/** Xbox user ID (XUID): 16 digits. */
const XBOX_XUID = /^\d{16}$/
/** PlayStation online ID: 3–16 characters, starts with a letter. */
const PSN_ONLINE_ID = /^[A-Za-z][A-Za-z0-9_-]{2,15}$/

export type ParsedGameAccountId =
    | {
          ok: true
          platform: GameAccountPlatform
          /** The ID as it is shown ("76561198000000017", "Hrac17CZ"). */
          id: string
          /** The ID as Logi stores it ("steam:76561198000000017"). */
          stored: string
      }
    | { ok: false; platform: GameAccountPlatform }

/** A Steam profile link `https://steamcommunity.com/profiles/<steam64>`. */
function steamFromProfileUrl(value: string) {
    if (!/^https?:\/\//i.test(value)) return undefined
    try {
        const url = new URL(value)
        if (
            !/^(www\.)?steamcommunity\.com$/i.test(url.hostname) ||
            url.port ||
            url.username ||
            url.password
        )
            return undefined
        return /^\/profiles\/(\d{17})\/?$/.exec(url.pathname)?.[1]
    } catch {
        return undefined
    }
}

/**
 * Checks an ID typed for a platform (M3-B08). Steam takes the Steam64 or a
 * `steamcommunity.com/profiles/…` link; Epic the 32-character account ID;
 * Xbox the gamertag or the 16-digit XUID; PlayStation the online ID. A
 * leading `platform:` prefix of the same platform is accepted.
 */
export function parseGameAccountId(
    platform: GameAccountPlatform,
    input: string
): ParsedGameAccountId {
    let value = input.trim().replace(/[\u0000-\u001f\u007f]/g, "")
    const prefix = new RegExp(`^${platform}:`, "i")
    value = value.replace(prefix, "").trim()
    let id: string | undefined
    switch (platform) {
        case "steam": {
            const candidate = steamFromProfileUrl(value) ?? value
            id = STEAM64.test(candidate) ? candidate : undefined
            break
        }
        case "epic":
            id = EPIC_ACCOUNT_ID.test(value) ? value.toLowerCase() : undefined
            break
        case "xbox":
            id =
                XBOX_GAMERTAG.test(value) || XBOX_XUID.test(value)
                    ? value
                    : undefined
            break
        case "playstation":
            id = PSN_ONLINE_ID.test(value) ? value : undefined
            break
    }
    return id
        ? { ok: true, platform, id, stored: `${platform}:${id}` }
        : { ok: false, platform }
}

const PREFIXES: Record<string, GameAccountPlatform> = {
    steam: "steam",
    epic: "epic",
    xbox: "xbox",
    xbl: "xbox",
    playstation: "playstation",
    psn: "playstation",
    ps: "playstation",
}

/** A stored account: its platform (or "other" for an old free-form ID) and the ID shown. */
export type StoredGameAccount = {
    stored: string
    platform: GameAccountPlatform | "other"
    id: string
}

/**
 * Reads a stored ID (`steam:7656…`, `xbox:Hrac17CZ`, or an old unprefixed
 * Steam64 or Epic ID) for display.
 */
export function readStoredGameAccount(stored: string): StoredGameAccount {
    const value = stored.trim()
    const match = /^([a-z]+):(.*)$/i.exec(value)
    const platform = match ? PREFIXES[match[1]!.toLowerCase()] : undefined
    if (match && platform) return { stored, platform, id: match[2]!.trim() }
    if (STEAM64.test(value)) return { stored, platform: "steam", id: value }
    if (EPIC_ACCOUNT_ID.test(value))
        return { stored, platform: "epic", id: value }
    return { stored, platform: "other", id: value }
}

/** Comparison key of a stored ID: the platform and the ID, case-insensitive. */
function accountKey(stored: string) {
    const account = readStoredGameAccount(stored)
    return `${account.platform}:${account.id.replace(/\s+/g, "").toLowerCase()}`
}

/**
 * The linked accounts an open application relies on (L4-B09): the ones its
 * answers name, or, when it names none, every linked account, because an
 * application is only accepted with a linked account. No open application
 * uses none.
 */
export function accountsUsedByApplication(
    linked: readonly string[],
    application: {
        answers: ReadonlyArray<{ value: string }>
    } | null
): Set<string> {
    if (!application) return new Set()
    const answers = application.answers.map((answer) =>
        answer.value.replace(/\s+/g, "").toLowerCase()
    )
    const named = linked.filter((stored) => {
        const id = readStoredGameAccount(stored)
            .id.replace(/\s+/g, "")
            .toLowerCase()
        return id && answers.some((answer) => answer.includes(id))
    })
    return new Set(named.length ? named : linked)
}

/** Whether two stored IDs name the same account. */
export function sameGameAccount(left: string, right: string) {
    return accountKey(left) === accountKey(right)
}
