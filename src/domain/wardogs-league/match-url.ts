export function matchUrl(input: string): { id: string; url: string } {
    if (
        !/^https:\/\/wardogsleague\.net\/matches\/[a-zA-Z0-9_-]{1,80}\/?$/.test(
            input
        )
    )
        throw new Error("Invalid Wardogs League match URL.")
    const url = new URL(input)
    const id = url.pathname.split("/")[2]
    return { id, url: `https://wardogsleague.net/matches/${id}` }
}
