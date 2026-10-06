import {
    errorCard,
    escapeMarkdownText,
    notAllowedCard,
    type MessageButton,
    type MessageField,
    type MessageView,
} from "../discord-messages/message-view"
import {
    discordTimestamp,
    fillTemplate,
    formatCount,
    type PluralForms,
} from "../discord-messages/format"
import { channelMention, czechFrom, joinNatural, roleMention } from "./text"
import { SERVER_STATUS_LIMIT } from "./catalog"

/** The `/server-status` copy of the commands module (`clan-language/commands.ts`). */
export type ServerStatusCopy = {
    label: string
    title: PluralForms
    intro: string
    online: string
    offline: string
    stale: string
    /** The chip of a stale row whose provider reported no state. */
    staleOnly: string
    noData: string
    disabled: string
    disabledHint: string
    players: string
    link: string
    shown: PluralForms
    serversOf: { one: string; other: string }
    notAllowedTitle: string
    notAllowedBody: string
    liveScoreWhere: string
    noConnectionsTitle: string
    noConnectionsBody: string
    unavailableTitle: string
    unavailableBody: string
    providers: Record<ServerStatusProvider, string>
    unnamed: string
}

export type ServerStatusProvider =
    "hll_crcon" | "wardogs_rcon" | "wardogs_warcon" | "wardogs_public_directory"

/** One stored connection as `/server-status` shows it. */
export type ServerStatusRow = {
    displayName: string | null
    /**
     * The state to name: the fresh state, or for a row that is not fresh the
     * last observed one (at most a day old), else "unknown".
     */
    state: "online" | "offline" | "unknown"
    freshness: "fresh" | "stale" | "unavailable"
    collecting: boolean
    players: number | null
    capacity: number | null
    map: string | null
    observedAt: string | null
    provider: ServerStatusProvider
}

const plain = (value: string | null | undefined, max = 80) =>
    escapeMarkdownText(
        (value ?? "")
            .replace(/[\p{Cc}\p{Cf}]/gu, " ")
            .replace(/@/g, "@​")
            .trim()
            .slice(0, max)
    )

function row(copy: ServerStatusCopy, server: ServerStatusRow): MessageField {
    const title =
        (server.displayName ?? "")
            .replace(/[\p{Cc}\p{Cf}]/gu, " ")
            .trim()
            .slice(0, 80) || copy.unnamed
    if (!server.collecting)
        return {
            title,
            chip: { label: copy.disabled, tone: "neutral" },
            text: copy.disabledHint,
        }
    // A row that is not fresh names its last known state with "zastaralé"
    // and the observation time (M3-23); without one it is "Bez dat", or
    // "Zastaralé" while the provider itself reported an unknown state.
    const known = server.state === "online" || server.state === "offline"
    const stateLabel = server.state === "offline" ? copy.offline : copy.online
    const chip =
        server.freshness === "fresh"
            ? known
                ? {
                      label: stateLabel,
                      tone:
                          server.state === "offline"
                              ? ("danger" as const)
                              : ("success" as const),
                  }
                : { label: copy.noData, tone: "neutral" as const }
            : known
              ? {
                    label: `${stateLabel} · ${copy.stale}`,
                    tone: "warning" as const,
                }
              : server.freshness === "stale"
                ? { label: copy.staleOnly, tone: "warning" as const }
                : { label: copy.noData, tone: "neutral" as const }
    // "Bez dat" does not repeat old players or map as if they were current.
    const noData = chip.label === copy.noData
    const details = [
        !noData && (server.players !== null || server.capacity !== null)
            ? fillTemplate(copy.players, {
                  players: String(server.players ?? "?"),
                  capacity: String(server.capacity ?? "?"),
              })
            : undefined,
        !noData && server.map ? plain(server.map, 60) : undefined,
        discordTimestamp(server.observedAt, "R"),
        // The public directory's data comes with its attribution link.
        server.provider === "wardogs_public_directory"
            ? `[${copy.providers[server.provider]}](https://wardogservers.com)`
            : copy.providers[server.provider],
    ].filter((part): part is string => Boolean(part))
    return { title, chip, text: details.join(" · ") }
}

/**
 * The private `/server-status` card (M3-22..24): game in the label, "N
 * servery klanu", one row per server with a state chip and "players · map ·
 * observed · source", at most five, a link to Herní servery and the count.
 */
export function buildServerStatusView(input: {
    copy: ServerStatusCopy
    language: string
    locale: string
    gameLabel: string
    rows: readonly ServerStatusRow[]
    gameServersUrl?: string
}): MessageView {
    const { copy } = input
    const shown = input.rows.slice(0, SERVER_STATUS_LIMIT)
    const total = input.rows.length
    const link: MessageButton | undefined = input.gameServersUrl
        ? { kind: "link", url: input.gameServersUrl, label: copy.link }
        : undefined
    const servers = total === 1 ? copy.serversOf.one : copy.serversOf.other
    const shownLine = formatCount(input.locale, shown.length, {
        ...copy.shown,
    })
        .replace("{shown}", String(shown.length))
        .replace("{total}", String(total))
        .replace("{from}", input.language === "cs" ? czechFrom(total) : "")
        .replace("{servers}", servers)
    return {
        accent: "clan",
        ephemeral: true,
        header: {
            label: fillTemplate(copy.label, { game: input.gameLabel }),
            title: formatCount(input.locale, total, copy.title),
        },
        blocks: [
            { kind: "text", markdown: copy.intro },
            { kind: "separator", divider: true, spacing: "small" },
            { kind: "fields", items: shown.map((server) => row(copy, server)) },
            { kind: "separator", divider: true, spacing: "small" },
            ...(link ? [{ kind: "buttons" as const, buttons: [link] }] : []),
            { kind: "text", markdown: `-# ${shownLine}` },
        ],
    }
}

/** Only Logi's managers (plus any extra roles) may see it (M3-25). */
export function serverStatusNotAllowedCard(input: {
    copy: ServerStatusCopy
    extraRoles: string
    or: string
    roleIds: readonly string[]
    liveScoreChannelId?: string | null
}): MessageView {
    const roles = input.roleIds
        .map(roleMention)
        .filter((value): value is string => Boolean(value))
    const live = channelMention(input.liveScoreChannelId)
    return notAllowedCard({
        title: input.copy.notAllowedTitle,
        whoMay: [
            input.copy.notAllowedBody,
            roles.length
                ? fillTemplate(input.extraRoles, {
                      roles: joinNatural(roles, input.or),
                  })
                : undefined,
            live
                ? fillTemplate(input.copy.liveScoreWhere, { channel: live })
                : undefined,
        ]
            .filter(Boolean)
            .join(" "),
    })
}

/** No server of the game is connected (M3-26). */
export function serverStatusNoConnectionsCard(input: {
    copy: ServerStatusCopy
    gameLabel: string
    gameServersUrl?: string
}): MessageView {
    return errorCard({
        title: fillTemplate(input.copy.noConnectionsTitle, {
            game: input.gameLabel,
        }),
        body: input.copy.noConnectionsBody,
        action: input.gameServersUrl
            ? {
                  kind: "link",
                  url: input.gameServersUrl,
                  label: input.copy.link,
              }
            : undefined,
    })
}

/** The stored status cannot be read (M3-27). */
export function serverStatusUnavailableCard(
    copy: ServerStatusCopy
): MessageView {
    return errorCard({
        title: copy.unavailableTitle,
        body: copy.unavailableBody,
    })
}
