import {
    seedCallLead,
    seedCallView,
    seedControlView,
    seedIntroView,
} from "../../../src/domain/discord-seed/views"
import {
    seedMapFacts as sharedSeedMapFacts,
    type SeedMapFacts,
} from "../../../src/domain/discord-seed/map"
import type {
    SeedDeliveryServer,
    SeedDeliveryState,
} from "../../../convex/discordSeedBot"
import type { MessageStyle } from "../../../src/domain/discord-messages/message-style"
import type { MessageView } from "../../../src/domain/discord-messages/message-view"
import type { StoredSeedRun } from "../../../src/application/discord-seed/ports"
import type { ServerSnapshot } from "../../../src/domain/game-data/contracts"
import { getSeedMessages } from "../../../src/lib/clan-language/seed"

/** The clan the seed messages are drawn for. */
export type SeedGuildContext = {
    language: string
    timeZone: string
    clanName: string | null
    messageStyle: MessageStyle | null
    /** The public Logi site, for map pictures and the P3 page. */
    siteUrl: string
}

/**
 * The map line ("Foy · Warfare · Den"), the map name and its picture, from
 * the shared domain rule the P3 previews use too (P3-19, P3-20).
 */
export function seedMapFacts(
    snapshot: ServerSnapshot | null,
    language: string,
    siteUrl: string
): SeedMapFacts {
    return sharedSeedMapFacts(
        {
            gameId: snapshot?.gameId ?? "hell_let_loose",
            map: snapshot?.map ?? null,
        },
        language,
        siteUrl
    )
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
