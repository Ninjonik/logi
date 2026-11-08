import { signupPreferencesSchema } from "@/lib/validation/event"
import { SIGNUP_NOT_ATTENDING } from "@/domain/events/types"
import { isLateSignupWindow } from "@/domain/events/status"
import { logRouteError } from "@/lib/server-route-errors"
import { NextResponse } from "next/server"

import {
    buildEventSignupActions,
    formatSignupResultMessage,
    resolveEventSignupSelection,
} from "@/lib/event-signup"
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags"
import { getResolvedMemberStatus } from "@/domain/assignments/policy"
import { getEventMessages } from "@/lib/clan-language/events"
import { toggleServerEventSignup } from "@/lib/server-events"
import { getServerContext } from "@/lib/server-context"
import { handleIfNotLoggedIn } from "@/lib/auth"

export async function POST(
    request: Request,
    { params }: { params: Promise<{ serverId: string; eventId: string }> }
) {
    const { serverId, eventId } = await params
    const user = await handleIfNotLoggedIn(
        `/dashboard/servers/${serverId}/calendar`
    )
    const context = await getServerContext(serverId)
    if (!context) {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }

    const event = context.events.find((item) => item.id === eventId)
    if (!event) {
        return NextResponse.json({ error: "Event not found." }, { status: 404 })
    }

    const body = (await request.json()) as {
        signupPreferences?: unknown
        actionId?: unknown
        lateSignupReason?: unknown
    }
    const messages = getEventMessages(
        context.discordConfig?.defaultLanguage ?? "en"
    )
    const assignment = context.assignments.find(
        (item) => item.userId === user.discordId
    )
    const resolvedMembershipStatus = assignment
        ? getResolvedMemberStatus(assignment.type, assignment.status)
        : null
    const membershipStatus =
        resolvedMembershipStatus && resolvedMembershipStatus !== "pending"
            ? resolvedMembershipStatus
            : null
    const resolved = resolveEventSignupSelection({
        event,
        groups: context.groups,
        memberRoleIds: context.memberRoleIds,
        assignedGroupIds: assignment
            ? [
                  assignment.primaryGroupId,
                  ...assignment.secondaryGroupIds,
              ].filter((groupId): groupId is string => Boolean(groupId))
            : [],
        membershipStatus,
        actionId: String(body.actionId ?? ""),
        labels: {
            registrationClosed: messages.interaction.registrationClosed,
            invalidSignupButton: messages.interaction.invalidSignupButton,
            unableToResolveMembership:
                messages.interaction.unableToResolveMembership,
            missingRequiredRole: messages.interaction.missingRequiredRole,
            membershipStatusNotAllowed:
                messages.interaction.membershipStatusNotAllowed,
            signupUpdated: messages.interaction.signupUpdated,
            markedNotAttending: messages.interaction.markedNotAttending,
        },
    })

    if (!resolved.ok) {
        return NextResponse.json({ error: resolved.error }, { status: 400 })
    }

    const preferences = signupPreferencesSchema
        .optional()
        .safeParse(body.signupPreferences)
    if (!preferences.success)
        return NextResponse.json(
            { error: messages.interaction.invalidSignupButton },
            { status: 400 }
        )
    for (const name of preferences.data ?? []) {
        const group = context.groups.find((item) => item.name === name)
        const choice = resolveEventSignupSelection({
            event,
            groups: context.groups,
            memberRoleIds: context.memberRoleIds,
            assignedGroupIds: assignment
                ? [
                      assignment.primaryGroupId,
                      ...assignment.secondaryGroupIds,
                  ].filter((id): id is string => Boolean(id))
                : [],
            membershipStatus,
            actionId: group?.id ?? "",
            labels: {
                registrationClosed: messages.interaction.registrationClosed,
                invalidSignupButton: messages.interaction.invalidSignupButton,
                unableToResolveMembership:
                    messages.interaction.unableToResolveMembership,
                missingRequiredRole: messages.interaction.missingRequiredRole,
                membershipStatusNotAllowed:
                    messages.interaction.membershipStatusNotAllowed,
                signupUpdated: messages.interaction.signupUpdated,
                markedNotAttending: messages.interaction.markedNotAttending,
            },
        })
        if (!choice.ok)
            return NextResponse.json({ error: choice.error }, { status: 400 })
    }
    const lateSignupReason =
        typeof body.lateSignupReason === "string"
            ? body.lateSignupReason.trim()
            : undefined
    if (
        resolved.group !== SIGNUP_NOT_ATTENDING &&
        isLateSignupWindow(event) &&
        (!lateSignupReason || lateSignupReason.length > 1000)
    ) {
        return NextResponse.json(
            { error: messages.lateSignup.required },
            { status: 400 }
        )
    }
    const result = await toggleServerEventSignup({
        eventId,
        userId: user.discordId,
        group: resolved.group,
        signupPreferences: preferences.data,
        lateSignupReason,
    })

    let cacheRefreshFailed = false
    try {
        revalidateCacheEntries([
            appCacheTags.serverContext(serverId),
            appCacheTags.events(serverId),
            appCacheTags.event(eventId),
            appCacheTags.rosters(serverId),
            appCacheTags.rosterImageEvent(eventId),
        ])
    } catch (error) {
        cacheRefreshFailed = true
        logRouteError("signup-cache-revalidation", error)
    }

    const { appliedSignupLabel, removed, signedUpLate } = result as {
        signedUpLate?: boolean
        appliedSignupLabel: string
        removed: boolean
    }
    const actions = buildEventSignupActions(
        event,
        context.groups,
        messages.buttons
    )
    const selectedAction = actions.find(
        (action) => action.id === String(body.actionId ?? "")
    )
    const emoji =
        selectedAction?.kind === "group" ? selectedAction.emoji : undefined

    return NextResponse.json({
        ok: true,
        ...(cacheRefreshFailed
            ? { warning: messages.interaction.cacheRefreshFailed }
            : {}),
        message: signedUpLate
            ? messages.lateSignup.saved
            : formatSignupResultMessage({
                  removed,
                  appliedSignupLabel,
                  labels: { ...messages.interaction, ...messages.buttons },
                  emoji,
              }),
    })
}
