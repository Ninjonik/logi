import { LeagueError } from "../../domain/wardogs-league/contracts"
import { matchUrl } from "../../domain/wardogs-league/match-url"
import { indexUrl } from "../../domain/wardogs-league/discovery"
import { load } from "cheerio"
export type LeagueIndex = { matchUrls: string[]; incomplete: boolean }
export function parseLeagueIndex(html: string, sourceUrl: string): LeagueIndex {
    indexUrl(sourceUrl)
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
    main.find("a[href]").each((_, el) => {
        const href = $(el).attr("href")!
        if (
            /\bnext\b/i.test($(el).attr("rel") ?? "") ||
            /[?&](page|cursor|offset|after)=/.test(href) ||
            /^(next|load more|show more)\b/i.test($(el).text().trim())
        )
            incomplete = true
        if ($(el).parents("nav").length) return
        try {
            urls.add(matchUrl(new URL(href, sourceUrl).href).url)
        } catch {
            /* Navigation, requests and external map links are excluded. */
        }
    })
    if (urls.size > 500) incomplete = true
    return { matchUrls: [...urls].slice(0, 500), incomplete }
}
