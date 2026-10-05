import assert from "node:assert/strict"
import test from "node:test"

import {
    buildDashboardBreadcrumbs,
    type DashboardCrumbLabels,
} from "@/lib/navigation/dashboard-breadcrumbs"

const labels: DashboardCrumbLabels = {
    workspace: "Clan",
    segments: {
        events: "Events",
        create: "Create",
        settings: "Clan settings",
        teams: "Teams",
        system: "System",
        "helper-data": "Helper data",
    },
    globalSegments: { teams: "Team catalogue", user: "User settings" },
    settingsSections: { discord: "Discord" },
    records: { events: "Event", competitions: "Competition" },
    detail: "Details",
}
const serverId = "k57a2bq9w8zxc3v4n5m6l7k8j9h0g1f2"

const trail = (pathname: string, serverName?: string) =>
    buildDashboardBreadcrumbs({
        locale: "cs",
        pathname,
        serverId,
        serverName,
        labels,
    }).map((crumb) => crumb.label)

test("a clan page shows the clan name and translated segments", () => {
    assert.deepEqual(trail(`/cs/dashboard/servers/${serverId}/events`, "VLK"), [
        "VLK",
        "Events",
    ])
})

test("record IDs are named by their kind, never shown raw", () => {
    assert.deepEqual(
        trail(
            `/cs/dashboard/servers/${serverId}/events/jd7f8a9s0d1f2g3h4j5k6l7z8x9c0v1b`,
            "VLK"
        ),
        ["VLK", "Events", "Event"]
    )
    assert.deepEqual(
        trail(`/cs/dashboard/competitions/jd7f8a9s0d1f2g3h4j5k6l7z8x9c0v1b`),
        ["Competitions", "Competition"]
    )
})

test("the clan segment falls back to a generic label without its name", () => {
    assert.deepEqual(trail(`/cs/dashboard/servers/${serverId}`), ["Clan"])
})

test("settings topics use their own titles", () => {
    assert.deepEqual(
        trail(`/cs/dashboard/servers/${serverId}/settings/discord`, "VLK"),
        ["VLK", "Clan settings", "Discord"]
    )
})

test("global pages use global labels and skip segments without a page", () => {
    assert.deepEqual(trail("/cs/dashboard/teams"), ["Team catalogue"])
    assert.deepEqual(trail("/cs/dashboard/settings/user"), ["User settings"])
})

test("unknown slugs are humanized and unknown IDs get the detail label", () => {
    assert.deepEqual(trail("/cs/dashboard/team-requests"), ["Team requests"])
    assert.deepEqual(trail("/cs/dashboard/bot/123456789012345678"), [
        "Bot",
        "Details",
    ])
})

test("hrefs accumulate and only the last crumb is marked", () => {
    const crumbs = buildDashboardBreadcrumbs({
        locale: "en",
        pathname: `/en/dashboard/servers/${serverId}/system/helper-data`,
        serverId,
        serverName: "VLK",
        labels,
    })
    assert.deepEqual(
        crumbs.map(({ href, isLast }) => ({ href, isLast })),
        [
            { href: `/en/dashboard/servers/${serverId}`, isLast: false },
            { href: `/en/dashboard/servers/${serverId}/system`, isLast: false },
            {
                href: `/en/dashboard/servers/${serverId}/system/helper-data`,
                isLast: true,
            },
        ]
    )
})

test("the dashboard root has no crumbs", () => {
    assert.deepEqual(trail("/cs/dashboard"), [])
})
