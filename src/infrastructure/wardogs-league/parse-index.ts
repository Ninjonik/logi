import type { IndexTab } from "../../domain/wardogs-league/all-fixtures"
import { LeagueError } from "../../domain/wardogs-league/contracts"
import { matchUrl } from "../../domain/wardogs-league/match-url"
import { indexUrl } from "../../domain/wardogs-league/discovery"
// `cheerio/slim` parses with htmlparser2 only; the full entry would bundle
// parse5, undici and the encoding sniffer into every Convex module that
// imports this parser (ARCHITECTURE.md, "Convex hot paths").
import { load } from "cheerio/slim"
/**
 * One public index tab. `fixtures` lists upcoming matches and `results`
 * finished ones; the League-wide collector uses the tab as a phase hint
 * before a match page has been read. The index carries no dates or
 * placements that Logi relies on, only match links.
 */
export type LeagueIndex = {
    tab: IndexTab
    matchUrls: string[]
    incomplete: boolean
}
export function parseLeagueIndex(html: string, sourceUrl: string): LeagueIndex {
    const tab = indexUrl(sourceUrl).id
    if (tab !== "fixtures" && tab !== "results")
        throw new Error("Invalid League index URL.")
    const $ = load(html),
        main = $("main").first()
    main.find("script,style,footer,form,[role=dialog]").remove()
    if (
        !main.find("h1").length ||
        !main.find('a[href="/matches?tab=fixtures"]').length ||
        !main.find('a[href="/matches?tab=results"]').length
    )
        throw new LeagueError("invalid_html")
    const urls = new Set<string>()
    let incomplete = false
    main.find('a[href],button,[role="button"]').each((_, el) => {
        const href = $(el).attr("href") ?? ""
        if (
            /\bnext\b/i.test($(el).attr("rel") ?? "") ||
            /[?&](page|cursor|offset|after)=/.test(href) ||
            /^(next|load more|show more)\b/i.test($(el).text().trim()) ||
            /^(next|load more|show more)\b/i.test(
                $(el).attr("aria-label") ?? ""
            )
        )
            incomplete = true
        if (!href || $(el).parents("nav").length) return
        try {
            urls.add(matchUrl(new URL(href, sourceUrl).href).url)
        } catch {
            /* Navigation, requests and external map links are excluded. */
        }
    })
    // No verified empty-state markup contract exists. Keep the last good index
    // rather than interpreting an app shell / truncated response as an empty list.
    if (!urls.size) throw new LeagueError("invalid_html")
    if (urls.size > 500) incomplete = true
    return { tab, matchUrls: [...urls].slice(0, 500), incomplete }
}
