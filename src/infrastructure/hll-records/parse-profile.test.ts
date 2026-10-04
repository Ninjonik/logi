import { parseHllProfile } from "./parse-profile"
import assert from "node:assert/strict"
import test from "node:test"

import { profileFixture } from "../testing/hll-profile"

test("real shared-column layout keeps maps and weapon counts in their own sections", () => {
    const columns = `<div><div><h2>Most played maps</h2></div><div><ol><li><div><div>Carentan Warfare</div><div>2</div></div></li></ol></div><div><h2>Other list</h2></div><ol><li>Not a map</li></ol><div><h2>Weapon usage</h2></div><div><table><tr><td>GEWEHR 43</td><td><div><div>48.17%</div><div><button>92</button></div></div></td></tr></table></div><div><h2>You versus</h2></div></div>`
    const html = profileFixture.replace(
        /<div><h2>Most played maps<\/h2>[\s\S]*?<\/main>/,
        columns + "</main>"
    )
    const p = parseHllProfile(html, "76561198199051397", "30d")
    assert.deepEqual(p.maps, ["Carentan Warfare 2"])
    assert.deepEqual(p.weapons, ["GEWEHR 43 · 48.17% 92"])
})

test("HLL semantic parser separates period totals from recent playstyle and retains lower bounds", () => {
    const p = parseHllProfile(profileFixture, "76561198199051397", "30d")
    assert.equal(p.name, "Fixture soldier")
    assert.equal(p.kills, 191)
    assert.equal(p.deaths, 232)
    assert.equal(p.kd, 0.82)
    assert.equal(p.matches, 9)
    assert.equal(p.hours, 6)
    assert.equal(p.lowerBound, true)
    assert.equal(p.teamKills, 5)
    assert.equal(p.elo, 1361)
    assert.equal(p.formWinRate, 40)
    assert.equal(p.recent[0].url, "https://hllrecords.com/matches/3461391")
    assert.match(p.weapons[0], /M1 GARAND/)
})

test("HLL parser fails closed on shield pages, wrong player, and changed markup", () => {
    for (const html of [
        "<h1>Establishing a secure connection</h1>",
        profileFixture.replace(/76561198199051397/g, "76561198000000001"),
        "<main><h2>Kills</h2></main>",
    ])
        assert.throws(() => parseHllProfile(html, "76561198199051397", "30d"))
})

test("missing optional HLL sections yield unknown metrics without contaminating totals", () => {
    const html = profileFixture
        .replace(/<dt>Total deaths<\/dt><dd>.*?<\/dd>/, "")
        .replace(/<dt>Overall K\/D ratio<\/dt><dd>.*?<\/dd>/, "")
    const p = parseHllProfile(html, "76561198199051397", "30d")
    assert.equal(p.deaths, null)
    assert.equal(p.kd, null)
    assert.ok(p.warnings.length)
})
