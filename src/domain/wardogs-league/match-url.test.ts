import assert from "node:assert/strict"
import { matchUrl } from "./match-url"
import test from "node:test"

const source = "https://wardogsleague.net/matches/cmuqt8ep605e1lf018w2nlywu"
test("canonical match ID and URL", () => {
    assert.deepEqual(matchUrl(source + "/"), {
        id: "cmuqt8ep605e1lf018w2nlywu",
        url: source,
    })
})
test("reject arbitrary origins, paths, credentials and ambiguous URL components", () => {
    for (const url of [
        source.replace("https:", "http:"),
        source.replace(".net", ".net.evil.test"),
        source.replace("wardogsleague.net", "localhost"),
        source.replace("/matches/", "/matches/requests/"),
        source + "?admin=1",
        source + "#x",
        source.replace(".net", ".net:444"),
        source.replace("https://", "https://user:password@"),
        source.replace("/matches/", "/other/../matches/"),
        source.replace("/matches/", "/matches/%2e%2e/"),
        source.replace("/matches/", "\\matches\\"),
        "//wardogsleague.net/matches/id",
        "https://wardogsleague.net/matches/a/b",
    ])
        assert.throws(() => matchUrl(url), /Invalid Wardogs League/, url)
})
