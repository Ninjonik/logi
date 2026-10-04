import {
    hllProfileUrl,
    type HllProfile,
    type StatsPeriod,
} from "../../domain/player-stats/player-stats"
import { load } from "cheerio"

/** Reads visible semantic HTML only; no RSC parsing or downloaded script execution. */
export function parseHllProfile(
    html: string,
    steamId: string,
    period: StatsPeriod
): HllProfile {
    const sourceUrl = hllProfileUrl(steamId, period),
        $ = load(html)
    $("script,style,footer,noscript").remove()
    // textContent joins adjacent block elements; preserve visible word boundaries.
    $("div,button,li,td,dd").append(" ")
    const text = (value: string) => value.replace(/\s+/g, " ").trim()
    const profileLink = $("h1").first().parent("a").attr("href")
    if (
        !profileLink ||
        new URL(profileLink, sourceUrl).origin !== "https://hllrecords.com" ||
        new URL(profileLink, sourceUrl).pathname !== `/profiles/${steamId}` ||
        !$("h2")
            .toArray()
            .some((h) => text($(h).text()).toLowerCase() === "service record")
    )
        throw new Error("HLL profile markup unavailable.")
    // Require the requested period in the rendered profile link too. A cache or
    // redirect must never turn a 30-day request into lifetime statistics.
    const actualPeriod =
        new URL(profileLink, sourceUrl).searchParams.get("period") ?? "all"
    if (actualPeriod !== period) throw new Error("HLL profile period mismatch.")
    const values = new Map<string, string>()
    $("dt").each((_, element) => {
        const label = text($(element).text()).toLowerCase()
        if (!values.has(label))
            values.set(label, text($(element).next("dd").text()))
    })
    const number = (value: string | undefined): number | null => {
        const match = value
            ?.replace(/[\u00a0\u202f]/g, "")
            .match(/^\s*([\d,]+(?:\.\d+)?)/)
        if (!match) return null
        const n = Number(match[1].replace(/,/g, ""))
        return Number.isFinite(n) && n >= 0 ? n : null
    }
    if (!values.has("matches played") || !values.has("enemy kills"))
        throw new Error("HLL profile statistics missing.")
    const played = values.get("matches played") ?? ""
    const kills = number(values.get("enemy kills")),
        deaths = number(values.get("total deaths"))
    const list = (heading: string, selector: string) => {
        const h = $("h2")
            .filter((_, el) => text($(el).text()).toLowerCase() === heading)
            .first()
        if (!h.length) return $([])
        let start = h
        for (let n = 0; n < 3 && start.length; n++, start = start.parent()) {
            if (start.find("h2").length > 1) break
            let region = start
            for (const sibling of start.nextAll().toArray()) {
                const candidate = $(sibling)
                if (candidate.is("h2") || candidate.find("h2").length) break
                region = region.add(candidate)
            }
            const found = region.find(selector)
            if (found.length) return found
        }
        return $([])
    }
    const recent = list("recent matches played", "ul > li")
        .slice(0, 5)
        .toArray()
        .flatMap((el) => {
            const link = $(el).find('a[href^="/matches/"]').first(),
                href = link.attr("href")
            if (!href || !/^\/matches\/\d+$/.test(href)) return []
            return [
                {
                    label: text($(el).text()).slice(0, 350),
                    url: `https://hllrecords.com${href}`,
                },
            ]
        })
    const form = $("h2")
        .filter((_, el) => text($(el).text()).toLowerCase() === "playstyle")
        .first()
    const formArea = form.parent().nextAll().slice(0, 2)
    const formMatch = text(formArea.text()).match(
        /Win rate\s*(\d+(?:\.\d+)?)%/i
    )
    const formWinRate =
        formMatch && Number(formMatch[1]) <= 100 ? Number(formMatch[1]) : null
    return {
        steamId,
        period,
        sourceUrl,
        name: text($("h1").first().text()).slice(0, 200),
        kills,
        deaths,
        kd: number(values.get("overall k/d ratio")),
        matches: number(played),
        hours: number(played.split("/")[1]),
        lowerBound: played.includes("+"),
        teamKills: number(values.get("team kills")),
        elo: number(values.get("infantry kill elo")),
        formWinRate,
        recent,
        maps: list("most played maps", "ol > li")
            .slice(0, 5)
            .toArray()
            .map((el) => text($(el).text()).slice(0, 200)),
        weapons: list("weapon usage", "tr")
            .slice(0, 5)
            .toArray()
            .map((el) =>
                $(el)
                    .find("td")
                    .toArray()
                    .map((td) => text($(td).text()))
                    .join(" · ")
                    .slice(0, 200)
            ),
        warnings: [
            kills === null ? "kills_missing" : null,
            deaths === null ? "deaths_missing" : null,
        ].filter((w): w is string => w !== null),
    }
}
