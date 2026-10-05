import {
    seedCallLead,
    seedCallView,
    seedControlView,
    seedIntroView,
} from "../../../src/domain/discord-seed/views"
import {
    liveMapLine,
    snapshotLiveFacts,
} from "../../../src/domain/discord-publications/live-panel"
import type {
    MessageMedia,
    MessageView,
} from "../../../src/domain/discord-messages/message-view"
import type {
    SeedDeliveryServer,
    SeedDeliveryState,
} from "../../../convex/discordSeedBot"
import type { MessageStyle } from "../../../src/domain/discord-messages/message-style"
import type { StoredSeedRun } from "../../../src/application/discord-seed/ports"
import type { ServerSnapshot } from "../../../src/domain/game-data/contracts"
import { getSeedMessages } from "../../../src/lib/clan-language/seed"
import { artworkPath } from "../public-panels/render"

/** The clan the seed messages are drawn for. */
export type SeedGuildContext = {
    language: string
    timeZone: string
    clanName: string | null
    messageStyle: MessageStyle | null
    /** The public Logi site, for map pictures and the P3 page. */
    siteUrl: string
}

/** The map line ("Foy · Warfare · Den"), the map name and its picture. */
export function seedMapFacts(
    snapshot: ServerSnapshot | null,
    language: string,
    siteUrl: string
): {
    mapLine: string | null
    mapName: string | null
    thumbnail: MessageMedia | null
} {
    if (!snapshot) return { mapLine: null, mapName: null, thumbnail: null }
    const facts = snapshotLiveFacts(snapshot)
    const path = facts.map
        ? artworkPath(snapshot.gameId, facts.map.key ?? snapshot.map)
        : null
    let thumbnail: MessageMedia | null = null
    if (path && facts.map)
        try {
            thumbnail = {
                url: new URL(path, siteUrl).href,
                description: facts.map.name,
            }
        } catch {
            thumbnail = null
        }
    return {
        mapLine: liveMapLine(facts, language) || null,
        mapName: facts.map?.name ?? null,
        thumbnail,
    }
}

/** The call of a run, with its "@Seed" line while it may ping. */
export function seedCallMessage(
    run: StoredSeedRun,
    server: SeedDeliveryServer | undefined,
    context: SeedGuildContext,
    now: number
): { view: MessageView; lead: ReturnType<typeof seedCallLead> } {
    const copy = getSeedMessages(context.language)
    const map = seedMapFacts(
        server?.snapshot ?? null,
        context.language,
        context.siteUrl
    )
    const settings = server?.settings
    const view = seedCallView({
        run,
        server: {
            name:
                server?.name ??
                run.serverName ??
                copy.game[server?.gameId ?? "hell_let_loose"],
            gameId: server?.gameId ?? "hell_let_loose",
        },
        mapLine: map.mapLine,
        template: settings?.template ?? null,
        roleButton:
            settings?.roleSelfService && settings.seedRoleId
                ? { roleId: settings.seedRoleId }
                : null,
        joinUrl: server?.joinUrl ?? null,
        thumbnail: map.thumbnail,
        updatedAt: run.players.observedAt ?? now,
        timeZone: context.timeZone,
        locale: copy.locale,
        copy,
    })
    return { view, lead: seedCallLead(run) }
}

/** The "Ovládání serveru" message of one server. */
export function seedControlMessage(
    server: SeedDeliveryServer,
    context: SeedGuildContext
): MessageView {
    const copy = getSeedMessages(context.language)
    const map = seedMapFacts(server.snapshot, context.language, context.siteUrl)
    return seedControlView({
        connectionId: server.connectionId,
        server: {
            name: server.name ?? copy.game[server.gameId],
            gameId: server.gameId,
        },
        status: server.status,
        seeding: Boolean(server.activeRun),
        players:
            server.activeRun?.players.latest ?? server.reading?.players ?? null,
        capacity: server.reading?.capacity ?? null,
        mapName: map.mapName,
        liveFrom: server.settings.liveFrom,
        panel: server.panel ? { paused: server.panel.paused } : null,
        locale: copy.locale,
        copy,
    })
}

/** The pinned intro of one seed channel. */
export function seedIntroMessage(
    intro: SeedDeliveryState["intros"][number],
    context: SeedGuildContext
): MessageView | null {
    if (!intro.show || !intro.roleId) return null
    return seedIntroView({
        clanName: context.clanName ?? "",
        servers: intro.servers,
        roleId: intro.roleId,
        copy: getSeedMessages(context.language),
    })
}
