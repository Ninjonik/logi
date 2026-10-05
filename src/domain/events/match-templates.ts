import type { GameId } from "@/domain/games/game"

import type { EventKind } from "./types"

export const SIGNUP_STATUSES = [
    "member",
    "recruit",
    "reserve_member",
    "mercenary",
] as const
export type TemplateSignupStatus = (typeof SIGNUP_STATUSES)[number]
export const REMINDER_STATUSES = [
    "member",
    "recruit",
    "reserve_member",
] as const
export type TemplateReminderStatus = (typeof REMINDER_STATUSES)[number]

export const MAX_MATCH_TEMPLATES = 20
const MAX_NAME_LENGTH = 60
const MAX_HOURS = 24 * 30
const MAX_MINUTES = 24 * 60

/**
 * What a new match or training starts with (design D1). A template only fills
 * the create form; saved events keep their own values, so editing a template
 * never changes an existing event.
 */
export type MatchTemplate = {
    id: string
    name: string
    kind: EventKind
    /** Missing means every game the clan plays. */
    gameId?: GameId
    /** Event category the new event gets. */
    categoryId?: string
    /** Hours before the start when the announcement is posted; missing posts it at once. */
    announcementHoursBeforeStart?: number
    registrationHoursBeforeMeeting: number
    meetingMinutesBeforeStart: number
    durationMinutes: number
    /** Empty lets every member status sign up. */
    allowedSignupStatuses: TemplateSignupStatus[]
    /** Missing offers every signup group of the event's game. */
    signupGroupIds?: string[]
    useGeneralSignup: boolean
    signupReminderStatuses: TemplateReminderStatus[]
    pingMode: "none" | "clan" | "roles"
    pingRoleIds: string[]
    createForumChannel: boolean
    createSquadVoiceChannels: boolean
    topicPresetId?: string
}

export type MatchTemplateError =
    | "too_many"
    | "duplicate_id"
    | "missing_name"
    | "invalid_times"
    | "missing_ping_roles"

function wholeNumber(value: number, max: number) {
    return Number.isInteger(value) && value >= 0 && value <= max
}

function unique<T>(values: readonly T[]) {
    return [...new Set(values)]
}

/** Checks and tidies a clan's templates before they are stored. */
export function normalizeMatchTemplates(
    templates: readonly MatchTemplate[]
):
    | { ok: true; templates: MatchTemplate[] }
    | { ok: false; error: MatchTemplateError; index?: number } {
    if (templates.length > MAX_MATCH_TEMPLATES)
        return { ok: false, error: "too_many" }
    const ids = new Set<string>()
    const normalized: MatchTemplate[] = []
    for (const [index, template] of templates.entries()) {
        const id = template.id.trim()
        if (!id || ids.has(id))
            return { ok: false, error: "duplicate_id", index }
        ids.add(id)
        const name = template.name.trim().slice(0, MAX_NAME_LENGTH)
        if (!name) return { ok: false, error: "missing_name", index }
        if (
            !wholeNumber(template.registrationHoursBeforeMeeting, MAX_HOURS) ||
            !wholeNumber(template.meetingMinutesBeforeStart, MAX_MINUTES) ||
            !wholeNumber(template.durationMinutes, MAX_MINUTES) ||
            template.durationMinutes < 1 ||
            (template.announcementHoursBeforeStart !== undefined &&
                !wholeNumber(template.announcementHoursBeforeStart, MAX_HOURS))
        )
            return { ok: false, error: "invalid_times", index }
        const pingRoleIds = unique(
            template.pingRoleIds.map((roleId) => roleId.trim()).filter(Boolean)
        )
        if (template.pingMode === "roles" && !pingRoleIds.length)
            return { ok: false, error: "missing_ping_roles", index }
        const isMatch = template.kind === "match"
        normalized.push({
            id,
            name,
            kind: template.kind,
            gameId: template.gameId,
            categoryId: template.categoryId?.trim() || undefined,
            announcementHoursBeforeStart: template.announcementHoursBeforeStart,
            registrationHoursBeforeMeeting:
                template.registrationHoursBeforeMeeting,
            meetingMinutesBeforeStart: template.meetingMinutesBeforeStart,
            durationMinutes: template.durationMinutes,
            allowedSignupStatuses: isMatch
                ? unique(template.allowedSignupStatuses)
                : [],
            // Signup groups belong to one game, so a template for every game offers them all.
            signupGroupIds:
                isMatch && template.gameId && template.signupGroupIds
                    ? unique(template.signupGroupIds)
                    : undefined,
            useGeneralSignup: isMatch && template.useGeneralSignup,
            signupReminderStatuses: isMatch
                ? unique(template.signupReminderStatuses)
                : [],
            pingMode: template.pingMode,
            pingRoleIds: template.pingMode === "roles" ? pingRoleIds : [],
            createForumChannel: isMatch && template.createForumChannel,
            createSquadVoiceChannels: template.createSquadVoiceChannels,
            topicPresetId: isMatch
                ? template.topicPresetId?.trim() || undefined
                : undefined,
        })
    }
    return { ok: true, templates: normalized }
}

/** Templates offered when creating an event of this kind for this game. */
export function templatesFor(
    templates: readonly MatchTemplate[] | undefined,
    kind: EventKind,
    gameId: GameId | undefined
) {
    return (templates ?? []).filter(
        (template) =>
            template.kind === kind &&
            (!template.gameId || !gameId || template.gameId === gameId)
    )
}

export type TemplateSchedule = {
    registrationStart?: string
    registrationEnd: string
    meetingStart: string
    gameStart: string
    gameEnd: string
}

const MINUTE_MS = 60 * 1000

/**
 * The timeline a template gives an event starting at `startIso`: the match
 * start for a match, the meeting for a training.
 */
export function templateSchedule(
    template: Pick<
        MatchTemplate,
        | "kind"
        | "announcementHoursBeforeStart"
        | "registrationHoursBeforeMeeting"
        | "meetingMinutesBeforeStart"
        | "durationMinutes"
    >,
    startIso: string
): TemplateSchedule | null {
    const start = Date.parse(startIso)
    if (!Number.isFinite(start)) return null
    const meeting =
        template.kind === "training"
            ? start
            : start - template.meetingMinutesBeforeStart * MINUTE_MS
    const gameStart = template.kind === "training" ? meeting : start
    const iso = (value: number) => new Date(value).toISOString()
    return {
        registrationStart:
            template.announcementHoursBeforeStart === undefined
                ? undefined
                : iso(
                      gameStart -
                          template.announcementHoursBeforeStart * 60 * MINUTE_MS
                  ),
        registrationEnd: iso(
            meeting - template.registrationHoursBeforeMeeting * 60 * MINUTE_MS
        ),
        meetingStart: iso(meeting),
        gameStart: iso(gameStart),
        gameEnd: iso(gameStart + template.durationMinutes * MINUTE_MS),
    }
}

/** A starting point for a clan's first template. */
export function defaultMatchTemplate(id: string, name: string): MatchTemplate {
    return {
        id,
        name,
        kind: "match",
        registrationHoursBeforeMeeting: 24,
        meetingMinutesBeforeStart: 30,
        durationMinutes: 90,
        allowedSignupStatuses: [],
        useGeneralSignup: false,
        signupReminderStatuses: ["member"],
        pingMode: "clan",
        pingRoleIds: [],
        createForumChannel: true,
        createSquadVoiceChannels: false,
    }
}
