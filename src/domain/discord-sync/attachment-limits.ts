/** Discord's level-0 upload policy used by Logi topic presets. */
export const DISCORD_LEVEL_ZERO_ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024
export const DISCORD_MESSAGE_MAX_ATTACHMENTS = 10
/** Discord's Create Message endpoint caps the complete multipart request. */
export const DISCORD_MESSAGE_MAX_UPLOAD_BYTES = 25 * 1024 * 1024

export function isDiscordLevelZeroAttachmentSizeValid(size: number) {
    return size <= DISCORD_LEVEL_ZERO_ATTACHMENT_MAX_BYTES
}
