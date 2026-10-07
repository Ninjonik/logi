import assert from "node:assert/strict"
import test from "node:test"

import {
    arrivalTimeOf,
    buildSignupList,
    filterSignupList,
    paginateSignupList,
    signupListMembership,
    signupTimesFromActivities,
    type SignupListInput,
} from "./signup-list"

const groups = [
    { id: "inf", name: "Pěchota" },
    { id: "tank", name: "Tanky" },
    { id: "recon", name: "Recon" },
    { id: "arty", name: "Arty" },
]

const participant = (
    userId: string,
    group: string | null,
    updatedAt: string,
    status: "attending" | "not_attending" = "attending",
    requestedGroup?: string
) => ({ userId, status, group, updatedAt, requestedGroup })

const input: SignupListInput = {
    groups,
    offeredGroupIds: ["inf", "tank", "recon"],
    limits: new Map([
        ["tank", 2],
        ["recon", 1],
    ]),
    participants: [
        participant("rex", "Pěchota", "2026-10-05T16:05:00.000Z"),
        participant("kowalski", "inf", "2026-10-05T16:04:00.000Z"),
        participant("tomcat", "Tanky", "2026-10-05T16:06:00.000Z"),
        participant("vlk", "tank", "2026-10-06T17:11:00.000Z"),
        participant("owl", "Recon", "2026-10-05T16:09:00.000Z"),
        participant(
            "fik",
            null,
            "2026-10-08T17:02:00.000Z",
            "attending",
            "Tanky"
        ),
        participant("kos", null, "2026-10-07T10:00:00.000Z", "not_attending"),
        participant("datel", "Pěchota", "2026-10-07T11:00:00.000Z"),
    ],
    absenceNotices: [
        {
            userId: "rex",
            reason: "Ve 20:15, končím v práci",
            createdAt: "x",
            kind: "late",
        },
        { userId: "kos", reason: "nemoc", createdAt: "x" },
        {
            userId: "datel",
            reason: "práce",
            createdAt: "x",
            kind: "cannot_come",
        },
    ],
    // The history knows Rex signed up first; his group change kept the time.
    signedUpAt: new Map([["rex", "2026-10-05T16:03:00.000Z"]]),
    memberships: new Map([
        ["kowalski", "member"],
        ["fik", "reserve_member"],
        ["owl", "recruit"],
    ]),
    leadership: false,
    unanswered: ["sokol", "cap"],
    names: new Map([
        ["sokol", "Sokol"],
        ["cap", "Čáp"],
    ]),
    locale: "cs-CZ",
}

test("sign-ups are listed by offered group in sign-up order (L1-74, L1-75, L1-B10)", () => {
    const list = buildSignupList(input)
    const kinds = list.sections.map((section) => section.kind)
    assert.deepEqual(kinds, ["group", "group", "group", "reserves", "declined"])
    const [inf, tank, recon] = list.sections
    assert.ok(inf?.kind === "group" && tank?.kind === "group")
    assert.deepEqual(
        inf.entries.map((entry) => entry.userId),
        ["rex", "kowalski"]
    )
    assert.equal(inf.max, undefined)
    assert.deepEqual(
        tank.entries.map((entry) => entry.userId),
        ["tomcat", "vlk"]
    )
    assert.equal(tank.max, 2)
    assert.ok(recon?.kind === "group" && recon.count === 1)
    assert.equal(inf.entries[1]?.membership, "member")
})

test("the summary counts players in groups; reserves have their own section (L1-72)", () => {
    const list = buildSignupList(input)
    assert.equal(list.summary.signedUp, 5)
    assert.equal(list.summary.counts.withoutGroup, 1)
    const reserves = list.sections.find(
        (section) => section.kind === "reserves"
    )
    assert.ok(reserves?.kind === "reserves")
    assert.equal(reserves.general, false)
    assert.deepEqual(reserves.entries[0], {
        userId: "fik",
        at: "2026-10-08T17:02:00.000Z",
        membership: "reserve_member",
        requestedGroup: "Tanky",
    })
})

test("a late notice shows the arrival time only; a cannot-come notice moves the player to Nepřijdou (L1-76)", () => {
    const list = buildSignupList(input)
    const inf = list.sections[0]
    assert.ok(inf?.kind === "group")
    assert.deepEqual(inf.entries[0]?.late, { arrival: "20:15" })
    const declined = list.sections.find(
        (section) => section.kind === "declined"
    )
    assert.ok(declined?.kind === "declined")
    assert.deepEqual(
        declined.entries.map((entry) => entry.userId),
        ["kos", "datel"]
    )
    // Members never see the reasons (L1-78).
    assert.equal(declined.withReasons, false)
    assert.ok(declined.entries.every((entry) => !("reason" in entry)))
    assert.ok(!list.sections.some((section) => section.kind === "unanswered"))
})

test("leadership also sees the reasons and the members without an answer, by name (L1-81, L1-82, L1-B09)", () => {
    const list = buildSignupList({ ...input, leadership: true })
    const declined = list.sections.find(
        (section) => section.kind === "declined"
    )
    assert.ok(declined?.kind === "declined")
    assert.equal(declined.withReasons, true)
    assert.deepEqual(
        declined.entries.map((entry) => [entry.userId, entry.reason]),
        [
            ["kos", "nemoc"],
            ["datel", "práce"],
        ]
    )
    const unanswered = list.sections.at(-1)
    assert.ok(unanswered?.kind === "unanswered")
    // Czech order: Čáp before Sokol.
    assert.deepEqual(
        unanswered.entries.map((entry) => entry.userId),
        ["cap", "sokol"]
    )
})

test("a match with a general sign-up calls players without a group 'Bez skupiny'", () => {
    const list = buildSignupList({ ...input, generalSignup: true })
    const reserves = list.sections.find(
        (section) => section.kind === "reserves"
    )
    assert.ok(reserves?.kind === "reserves" && reserves.general)
})

test("a training lists everyone attending in one section", () => {
    const list = buildSignupList({
        ...input,
        kind: "training",
        participants: [
            participant("a", "ATTEND", "2026-10-05T16:04:00.000Z"),
            participant("b", null, "2026-10-05T16:03:00.000Z"),
            participant("c", null, "2026-10-05T16:05:00.000Z", "not_attending"),
        ],
        absenceNotices: [],
    })
    assert.deepEqual(
        list.sections.map((section) => section.kind),
        ["attending", "declined"]
    )
    assert.equal(list.summary.signedUp, 2)
    assert.deepEqual(
        list.sections[0]?.entries.map((entry) => entry.userId),
        ["b", "a"]
    )
})

test("the arrival time is read from a late notice's text", () => {
    assert.equal(arrivalTimeOf("Ve 20:15, končím v práci"), "20:15")
    assert.equal(arrivalTimeOf("dorazím 9.45"), "09:45")
    assert.equal(arrivalTimeOf("po práci"), null)
    assert.equal(arrivalTimeOf("2026"), null)
    assert.equal(arrivalTimeOf(undefined), null)
})

test("the membership chip follows the assignment; applicants have none", () => {
    assert.equal(
        signupListMembership({ type: "member", status: "active" }),
        "member"
    )
    assert.equal(
        signupListMembership({ type: "reserve_member", status: "active" }),
        "reserve_member"
    )
    assert.equal(
        signupListMembership({ type: "member", status: "recruit" }),
        "recruit"
    )
    assert.equal(
        signupListMembership({ type: "mercenary", status: "active" }),
        "mercenary"
    )
    assert.equal(
        signupListMembership({ type: "member", status: "pending" }),
        null
    )
    assert.equal(signupListMembership(null), null)
})

test("the sign-up time is the last sign-up; a group change keeps it, a decline resets it", () => {
    const times = signupTimesFromActivities([
        {
            userId: "a",
            action: "changed_role",
            occurredAt: "2026-10-05T17:00:00Z",
        },
        {
            userId: "a",
            action: "signed_up",
            occurredAt: "2026-10-05T16:00:00Z",
        },
        {
            userId: "b",
            action: "signed_up",
            occurredAt: "2026-10-05T16:10:00Z",
        },
        { userId: "b", action: "declined", occurredAt: "2026-10-05T16:20:00Z" },
        {
            userId: "c",
            action: "signed_up",
            occurredAt: "2026-10-05T16:10:00Z",
        },
        { userId: "c", action: "declined", occurredAt: "2026-10-05T16:20:00Z" },
        {
            userId: "c",
            action: "signed_up",
            occurredAt: "2026-10-05T16:30:00Z",
        },
    ])
    assert.deepEqual(Object.fromEntries(times), {
        a: "2026-10-05T16:00:00Z",
        c: "2026-10-05T16:30:00Z",
    })
})

test("filters narrow the list to one group or (leadership) to Bez odpovědi (L1-73, L1-86)", () => {
    const list = buildSignupList({ ...input, leadership: true })
    assert.deepEqual(
        filterSignupList(list.sections, { kind: "group", id: "tank" }).map(
            (section) => (section.kind === "group" ? section.id : section.kind)
        ),
        ["tank"]
    )
    assert.deepEqual(
        filterSignupList(list.sections, { kind: "unanswered" }).map(
            (section) => section.kind
        ),
        ["unanswered"]
    )
    // An unknown group (renamed meanwhile) falls back to everything.
    assert.equal(
        filterSignupList(list.sections, { kind: "group", id: "gone" }).length,
        list.sections.length
    )
})

const sectionId = (section: { kind: string }) =>
    "id" in section ? String(section.id) : section.kind

function bigList(sizes: number[]) {
    return sizes.map((size, index) => ({
        kind: "group" as const,
        id: `g${index}`,
        name: `G${index}`,
        count: size,
        entries: Array.from({ length: size }, (_, entry) => ({
            userId: `g${index}-${entry}`,
            at: null,
            membership: null,
        })),
    }))
}

test("up to 40 names fit on one page; more page without splitting a section that fits (L1-80)", () => {
    assert.equal(paginateSignupList(bigList([15, 6, 2, 17])).length, 1)
    const pages = paginateSignupList(bigList([25, 10, 6]))
    assert.equal(pages.length, 2)
    assert.deepEqual(
        pages.map((page) => page.map((chunk) => sectionId(chunk.section))),
        [["g0", "g1"], ["g2"]]
    )
})

test("a section longer than a page continues with its numbering", () => {
    const pages = paginateSignupList(bigList([30, 50]))
    assert.equal(pages.length, 2)
    assert.deepEqual(
        pages.map((page) =>
            page.map((chunk) => [
                sectionId(chunk.section),
                chunk.start,
                chunk.entries.length,
            ])
        ),
        [
            [
                ["g0", 0, 30],
                ["g1", 0, 10],
            ],
            [["g1", 10, 40]],
        ]
    )
    // A section that fits on a fresh page moves there whole.
    assert.deepEqual(
        paginateSignupList(bigList([30, 30])).map((page) =>
            page.map((chunk) => [sectionId(chunk.section), chunk.start])
        ),
        [[["g0", 0]], [["g1", 0]]]
    )
    const huge = paginateSignupList(bigList([95]))
    assert.deepEqual(
        huge.map((page) => page[0]?.start),
        [0, 40, 80]
    )
})

test("a text budget pages earlier than 40 long rows", () => {
    const pages = paginateSignupList(bigList([30]), {
        maxCost: 1000,
        entryCost: () => 100,
        headerCost: () => 50,
    })
    assert.deepEqual(
        pages.map((page) => page[0]?.entries.length),
        [9, 9, 9, 3]
    )
})

test("an empty list is one empty page", () => {
    assert.deepEqual(paginateSignupList([]), [[]])
})
