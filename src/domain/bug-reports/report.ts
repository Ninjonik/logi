import { z } from "zod"

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024
export const MAX_ATTACHMENTS = 5
export const reportStatus = z.enum(["new", "investigating", "resolved"])
export const reportInput = z.object({
    title: z.string().trim().min(3).max(160),
    message: z.string().trim().min(10).max(10000),
    server: z.string().trim().max(200).default(""),
    occurredAt: z.number().finite().nonnegative().optional(),
})
export const attachmentInput = z.object({
    storageId: z.string().min(1),
    name: z.string().min(1).max(200),
    size: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
})
export type ReportInput = z.infer<typeof reportInput>
export type Attachment = z.infer<typeof attachmentInput>
export type Report = ReportInput & {
    _id: string
    _creationTime: number
    reporter: string
    status: z.infer<typeof reportStatus>
    attachments: Attachment[]
}

export function validAttachment(file: { name: string; size: number }) {
    return (
        file.size > 0 &&
        file.size <= MAX_ATTACHMENT_BYTES &&
        file.name.length <= 200 &&
        /\.(png|jpe?g|webp|gif|txt|log|json|csv|zip)$/i.test(file.name)
    )
}
