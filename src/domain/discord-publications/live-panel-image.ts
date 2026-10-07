import {
    panelImageText,
    panelScoreImageSchema,
    type PanelScoreImage,
} from "./panel-image-model"
import {
    liveLeaders,
    type LivePanelState,
    type LiveServerFacts,
} from "./live-panel"
import { isWardogsFaction, type WardogsFaction } from "./panel-emblems"
import type { ScoreImageBackground } from "./panel-graphics"
import { PANEL_IMAGE_LANGUAGES } from "./panel-image-copy"

/**
 * The style A score image (P7-07, P7-15) filled from the same live facts as
 * the text under it. Paused panels draw no image; a model the renderer
 * would refuse (an unknown map key, a missing name) gives none either, and
 * the panel falls back to its full text card.
 *
 * The panel's switches decide what is drawn (L3-33, L3-36): the score and the
 * round time only with "Skóre" on and the server live, the top players only
 * with "Nejlepší hráči" on as well. An empty server shows its empty state
 * and a running seed its progress toward the threshold (P4-16, P4-18). What
 * is not drawn is left out of the model, so it never changes the image.
 */
export function liveScoreImageModel(input: {
    facts: LiveServerFacts
    state: LivePanelState
    language: string
    timeZone: string
    renderedAt: number
    /** Resolved bar colour, `#rrggbb`. */
    accentColor: string
    serverName: string
    newMap: boolean
    background: ScoreImageBackground | null
    showQueue: boolean
    showNextMap: boolean
    joinCode: string | null
    /** The panel's "Skóre" switch; off is the server-status look. */
    showScore: boolean
    /** The panel's "Nejlepší hráči" switch. */
    showLeaders: boolean
    /** The running seed's live threshold, or null without a seed. */
    seedTarget: number | null
}): PanelScoreImage | null {
    const { facts } = input
    if (input.state === "paused") return null
    const scored =
        input.showScore && (input.state === "live" || input.state === "stale")
    const ranked = scored && input.showLeaders && facts.rosterFresh
    const serverName = panelImageText(input.serverName, 64)
    if (!serverName) return null
    const language = (PANEL_IMAGE_LANGUAGES as readonly string[]).includes(
        input.language
    )
        ? (input.language as PanelScoreImage["language"])
        : "en"
    const mapName = facts.map ? panelImageText(facts.map.name, 48) : null
    const base = {
        version: 1 as const,
        language,
        timeZone: input.timeZone,
        renderedAt: new Date(input.renderedAt).toISOString(),
        accentColor: input.accentColor.toLowerCase(),
        serverName,
        state:
            input.state === "stale"
                ? ("live" as const)
                : (input.state as "live" | "seeding" | "empty" | "offline"),
        newMap: input.newMap,
        map: mapName ? { name: mapName, key: facts.map?.key ?? null } : null,
        background: input.background,
        players:
            facts.players !== null &&
            facts.capacity !== null &&
            facts.capacity > 0
                ? {
                      count: facts.players,
                      capacity: facts.capacity,
                      queue: input.showQueue ? facts.queue : null,
                  }
                : null,
        scoreboard: input.showScore,
        seedTarget:
            input.state === "seeding" &&
            input.seedTarget !== null &&
            Number.isInteger(input.seedTarget) &&
            input.seedTarget >= 1
                ? input.seedTarget
                : null,
    }
    const name = (value: string) => panelImageText(value, 32)
    const model =
        facts.game === "hell_let_loose"
            ? {
                  ...base,
                  game: "hell_let_loose" as const,
                  leaders: (ranked
                      ? liveLeaders(facts.roster, "kills")
                      : []
                  ).flatMap((player) => {
                      const label = name(player.name)
                      return label && player.kills !== null
                          ? [
                                {
                                    name: label,
                                    value: Math.round(player.kills),
                                    side:
                                        player.side === "allies" ||
                                        player.side === "axis"
                                            ? player.side
                                            : null,
                                },
                            ]
                          : []
                  }),
                  mode: facts.mode,
                  lighting: facts.lighting,
                  timeLeftSeconds:
                      scored &&
                      facts.timeLeftSeconds !== null &&
                      facts.timeLeftSeconds <= 86_400
                          ? facts.timeLeftSeconds
                          : null,
                  nextMap:
                      input.showNextMap && facts.nextMap
                          ? {
                                name:
                                    panelImageText(facts.nextMap.name, 48) ??
                                    "—",
                                lighting: facts.nextMap.lighting,
                            }
                          : null,
                  allies: {
                      nation: facts.hll?.nations.allies ?? "allies",
                      score: scored ? (facts.hll?.allies ?? null) : null,
                  },
                  axis: {
                      nation: facts.hll?.nations.axis ?? "axis",
                      score: scored ? (facts.hll?.axis ?? null) : null,
                  },
              }
            : {
                  ...base,
                  game: "wardogs" as const,
                  leaders: (ranked
                      ? liveLeaders(facts.roster, "kills")
                      : []
                  ).flatMap((player) => {
                      const label = name(player.name)
                      const side = player.side?.trim().toLowerCase()
                      return label && player.kills !== null
                          ? [
                                {
                                    name: label,
                                    value: Math.round(player.kills),
                                    side: isWardogsFaction(side)
                                        ? (side as WardogsFaction)
                                        : null,
                                },
                            ]
                          : []
                  }),
                  joinCode:
                      input.joinCode &&
                      /^[A-Za-z0-9-]{1,24}$/.test(input.joinCode)
                          ? input.joinCode
                          : null,
                  factions: (scored ? (facts.wardogs?.factions ?? []) : [])
                      .filter(
                          (
                              faction
                          ): faction is typeof faction & {
                              key: WardogsFaction
                          } => faction.key !== null
                      )
                      .filter(
                          (faction, index, all) =>
                              all.findIndex(
                                  (other) => other.key === faction.key
                              ) === index
                      )
                      .slice(0, 3)
                      .map((faction) => ({
                          faction: faction.key,
                          points: faction.points,
                      })),
                  topCash: (() => {
                      const top = ranked
                          ? liveLeaders(facts.roster, "cash")[0]
                          : undefined
                      const label = top ? name(top.name) : null
                      return top && label && top.cash !== null
                          ? { name: label, value: Math.round(top.cash) }
                          : null
                  })(),
              }
    const parsed = panelScoreImageSchema.safeParse(model)
    return parsed.success ? parsed.data : null
}
