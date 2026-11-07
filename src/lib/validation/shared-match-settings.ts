import {
    eventSchema,
    attendanceReminderHoursSchema,
    signupGroupLimitsSchema,
} from "./event"
import { z } from "zod"

export const sharedMatchSettingsSchema = z.strictObject({
    registrationStart: z.string().datetime().optional(),
    localRosterMessageVariant: z.enum(["photo_text", "photo"]).optional(),
    localRosterMentionPlayers: z.boolean().optional(),
    announcementChannelId: eventSchema.shape.announcementChannelId,
    eventInfoChannelId: eventSchema.shape.eventInfoChannelId,
    eventResultsChannelId: eventSchema.shape.eventResultsChannelId,
    meetingChannelId: eventSchema.shape.meetingChannelId,
    squadVoiceCategoryId: eventSchema.shape.squadVoiceCategoryId,
    pingMode: eventSchema.shape.pingMode,
    pingRoleIds: eventSchema.shape.pingRoleIds,
    requiredRoleIds: eventSchema.shape.requiredRoleIds,
    rewardRoleIds: eventSchema.shape.rewardRoleIds,
    signupGroupIds: eventSchema.shape.signupGroupIds,
    allowedSignupStatuses: eventSchema.shape.allowedSignupStatuses,
    signupReminderStatuses: eventSchema.shape.signupReminderStatuses,
    attendanceReminderHours: attendanceReminderHoursSchema,
    signupGroupLimits: signupGroupLimitsSchema,
    allowNonMembersSignup: eventSchema.shape.allowNonMembersSignup,
    useGeneralSignup: eventSchema.shape.useGeneralSignup,
    createParticipantRoles: z.boolean(),
    createSquadVoiceChannels: eventSchema.shape.createSquadVoiceChannels,
    createForumChannel: eventSchema.shape.createForumChannel,
    createSignupThread: eventSchema.shape.createSignupThread,
    createDebriefThread: eventSchema.shape.createDebriefThread,
    deleteForumAfterConclusion: eventSchema.shape.deleteForumAfterConclusion,
    debriefDestination: eventSchema.shape.debriefDestination,
    debriefForumChannelId: eventSchema.shape.debriefForumChannelId,
    topicPresetId: eventSchema.shape.topicPresetId,
})
export type SharedMatchSettings = z.infer<typeof sharedMatchSettingsSchema>
