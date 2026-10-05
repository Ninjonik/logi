import assert from "node:assert/strict"
import test from "node:test"

import { buildAnnouncementPreview } from "./discord-announcement-preview"

const match = {
    kind: "match" as const,
    name: "VLK vs ROG",
    language: "en",
    registrationEnd: "2026-10-10T17:30:00.000Z",
    meetingStart: "2026-10-11T17:30:00.000Z",
    gameStart: "2026-10-11T18:00:00.000Z",
    signupGroups: [{ name: "Infantry", emoji: "🪖" }, { name: "Tanks" }],
    mentions: ["Members"],
}

test("a match lists times first, then details, then status like the bot", () => {
    const preview = buildAnnouncementPreview(
        {
            ...match,
            side: "Allies",
            server: "EU #1",
            serverPassword: "secret",
            notes: "Bring a mic",
            category: { label: "Friendly", color: "#22c55e" },
        },
        "Untitled"
    )
    assert.equal(preview.title, "VLK vs ROG")
    assert.equal(preview.accentColor, "#22c55e")
    assert.deepEqual(preview.mentions, ["Members"])
    assert.deepEqual(
        preview.blocks.map((block) => block.map((line) => line.label)),
        [
            ["Headcount Start", "Match Start", "Registration Ends"],
            ["Side", "Server", "Password", "Description"],
            ["Match", "Status", "People signed up"],
        ]
    )
    assert.deepEqual(preview.blocks[1][2].values, [
        { kind: "code", text: "secret" },
    ])
    assert.deepEqual(
        preview.signupSections.map((section) => section.title),
        ["🪖 Infantry (0)", "👥 Tanks (0)", "❌ Not Attending (0)"]
    )
    assert.deepEqual(
        preview.buttons.map((button) => button.style),
        ["success", "primary", "danger", "link"]
    )
})

test("empty details collapse into one divider", () => {
    const preview = buildAnnouncementPreview(match, "Untitled")
    assert.equal(preview.blocks.length, 2)
    assert.equal(preview.accentColor, "#FFB000")
})

test("a training shows its meeting and generic attend buttons", () => {
    const preview = buildAnnouncementPreview(
        { ...match, kind: "training", name: " ", serverPassword: "hidden" },
        "Untitled"
    )
    assert.equal(preview.title, "Untitled")
    assert.deepEqual(
        preview.blocks.flat().map((line) => line.label),
        [
            "Registration Ends",
            "Headcount / Meeting",
            "Training Start",
            "Status",
            "People signed up",
        ]
    )
    assert.equal(preview.signupSections.length, 2)
    assert.equal(preview.buttons[0].emoji, "✅")
})

test("labels follow the clan's bot language", () => {
    const preview = buildAnnouncementPreview(
        { ...match, language: "cs" },
        "Bez názvu"
    )
    assert.notEqual(preview.blocks[0][0].label, "Headcount Start")
})
