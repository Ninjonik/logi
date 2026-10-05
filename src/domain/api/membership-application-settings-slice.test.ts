import assert from "node:assert/strict"
import test from "node:test"

import {
    applyClanSettingsSlicePatches,
    clanSettingsSliceJsonSchemas,
    readClanSettingsSlices,
} from "./settings-slices"
import { membershipApplicationSettingsSlice as slice } from "./membership-application-settings-slice"
import { CLAN_SETTINGS_SLICES } from "./clan-settings-slices"

const categories = [
    {
        id: "main",
        label: "Hlavní četa",
        gameId: "hell_let_loose",
        assignmentType: "member",
        supportRoleIds: [],
        recruitRoleIds: ["1"],
        finalRoleIds: ["2"],
        modalQuestions: [],
    },
    {
        id: "wd",
        label: "Wardogs",
        gameId: "wardogs",
        assignmentType: "mercenary",
        supportRoleIds: [],
        recruitRoleIds: [],
        finalRoleIds: ["3"],
        modalQuestions: [],
    },
]

const source = (membershipSettings: Record<string, unknown> | undefined) => ({
    discordConfig: {
        defaultLanguage: "cs",
        ...(membershipSettings ? { membershipSettings } : {}),
    },
})

const stored = {
    enabled: true,
    submitChannelId: "123456789012345678",
    applicationParentChannelId: "223456789012345678",
    panelTitle: "Přidej se k nám",
    panelDescription: "Hledáme hráče.",
    autoAssignRecruitOnApply: false,
    categories,
}

const apply = (patch: unknown, settings: Record<string, unknown> = stored) =>
    applyClanSettingsSlicePatches(
        { membershipApplication: patch },
        source(settings),
        CLAN_SETTINGS_SLICES
    )

test("the slice is listed and documented in OpenAPI (N4-B09)", () => {
    assert.ok(CLAN_SETTINGS_SLICES.includes(slice))
    const schemas = clanSettingsSliceJsonSchemas([slice])
    assert.ok(schemas.ClanSettingsMembershipApplicationSlice)
    assert.ok(schemas.ClanSettingsMembershipApplicationPatch)
    assert.match(
        String(schemas.ClanSettingsMembershipApplicationSlice.description),
        /not part of the API/
    )
})

test("a clan with nothing saved reads the default form in its language", () => {
    const value = slice.read(source(undefined))
    assert.equal(value.enabled, false)
    assert.equal(value.formSource, "default")
    assert.equal(value.webFormEnabled, false)
    assert.equal(value.draftTtlHours, 24)
    assert.equal(value.form.about[0]?.label, "Odkud o nás víš?")
    assert.deepEqual(value.categories, [])
    assert.ok(slice.schema.safeParse(value).success)
})

test("stored settings map to the API names; Wardogs never asks for a specialization", () => {
    const value = readClanSettingsSlices(source(stored), [slice])
        .membershipApplication as ReturnType<typeof slice.read>
    assert.equal(value.panelChannelId, "123456789012345678")
    assert.equal(value.threadChannelId, "223456789012345678")
    assert.equal(value.panelText, "Hledáme hráče.")
    assert.equal(value.mentionSupportRoles, true)
    assert.equal(value.sendConfirmationDm, true)
    assert.deepEqual(value.categories, [
        {
            id: "main",
            label: "Hlavní četa",
            game: "hell_let_loose",
            askSpecialization: true,
        },
        {
            id: "wd",
            label: "Wardogs",
            game: "wardogs",
            askSpecialization: false,
        },
    ])
})

test("a patch writes only the supplied fields of the membership settings", () => {
    const result = apply({
        threadChannelId: null,
        webFormEnabled: true,
        welcomeMessage: "",
        askSpecialization: { main: false },
        enabled: false,
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    const next = result.patch.membershipSettings as Record<string, unknown>
    assert.equal(next.applicationParentChannelId, undefined)
    assert.equal(next.webFormEnabled, true)
    assert.equal(next.applicationWelcomeMessage, undefined)
    assert.equal(next.panelTitle, "Přidej se k nám")
    assert.deepEqual(
        (
            next.categories as Array<{
                id: string
                askSpecialization?: boolean
            }>
        ).map((category) => [category.id, category.askSpecialization]),
        [
            ["main", false],
            ["wd", undefined],
        ]
    )
})

test("a custom form is saved and null returns to the default", () => {
    const form = slice.read(source(stored)).form
    const custom = {
        ...form,
        questionWindows: [form.questionWindows[0]!],
    }
    const saved = apply({ form: custom })
    assert.equal(saved.ok, true)
    if (!saved.ok) return
    const settings = saved.patch.membershipSettings as Record<string, unknown>
    assert.equal(slice.read(source(settings)).formSource, "custom")
    const reset = apply({ form: null }, settings)
    assert.equal(reset.ok, true)
    if (!reset.ok) return
    assert.equal(
        (reset.patch.membershipSettings as Record<string, unknown>)
            .applicationForm,
        undefined
    )
})

test("Discord's five fields per window are checked against the clan's categories (N4-B03)", () => {
    const form = slice.read(source(stored)).form
    const sixth = {
        id: "extra",
        kind: "custom",
        type: "short_text",
        label: "Ještě něco?",
        required: false,
    }
    const full = {
        ...form,
        questionWindows: [
            {
                ...form.questionWindows[0]!,
                questions: [...form.questionWindows[0]!.questions, sixth],
            },
        ],
    }
    const result = apply({ form: full })
    assert.equal(result.ok, false)
    if (!result.ok)
        assert.match(
            result.error,
            /membershipApplication: form\.q1: window-full/
        )
    // The same sixth question fits once the category stops asking for a
    // specialization in that window.
    assert.equal(
        apply({ form: full, askSpecialization: { main: false } }).ok,
        true
    )
})

test("unknown categories, Wardogs specialization and bad switches are refused", () => {
    const form = slice.read(source(stored)).form
    const filtered = {
        ...form,
        about: [{ ...form.about[0]!, categoryIds: ["missing"] }],
    }
    assert.match(
        String((apply({ form: filtered }) as { error?: string }).error),
        /category-unknown/
    )
    assert.match(
        String(
            (apply({ askSpecialization: { wd: true } }) as { error?: string })
                .error
        ),
        /only Hell Let Loose/
    )
    assert.match(
        String(
            (apply({ askSpecialization: { nope: true } }) as { error?: string })
                .error
        ),
        /unknown category/
    )
    assert.match(
        String((apply({ panelChannelId: null }) as { error?: string }).error),
        /panelChannelId/
    )
    assert.equal(apply({ panelChannelId: "x" }).ok, false)
    assert.equal(apply({ decision: "member" }).ok, false)
    assert.equal(apply({ draftTtlHours: 48 }).ok, false)
})

test("the panel colour is read and written as #RRGGBB; null is the clan colour (L4-10)", () => {
    assert.equal(slice.read(source(stored)).panelAccentColor, null)
    const saved = apply({ panelAccentColor: "#3b82f6" })
    assert.equal(saved.ok, true)
    if (!saved.ok) return
    const settings = saved.patch.membershipSettings as Record<string, unknown>
    assert.equal(settings.panelAccentColor, "#3B82F6")
    assert.equal(slice.read(source(settings)).panelAccentColor, "#3B82F6")
    const cleared = apply({ panelAccentColor: null }, settings)
    assert.equal(cleared.ok, true)
    if (!cleared.ok) return
    assert.equal(
        (cleared.patch.membershipSettings as Record<string, unknown>)
            .panelAccentColor,
        undefined
    )
    assert.equal(apply({ panelAccentColor: "blue" }).ok, false)
})
