import {
    attachmentInput,
    MAX_ATTACHMENTS,
    reportInput,
    validAttachment,
    type Attachment,
    type ReportInput,
} from "../../domain/bug-reports/report"
import { z } from "zod"

export interface BugReportRepository {
    recentCount(reporter: string, since: number): Promise<number>
    insert(
        report: ReportInput & {
            reporter: string
            status: "new"
            attachments: Attachment[]
        }
    ): Promise<string>
}

export async function submitReport(
    repository: BugReportRepository,
    reporter: string,
    input: unknown,
    attachments: unknown,
    now: number
) {
    const report = reportInput.parse(input)
    const files = z
        .array(attachmentInput)
        .max(MAX_ATTACHMENTS)
        .parse(attachments)
    if (files.some((file) => !validAttachment(file)))
        throw new Error("invalid_attachment")
    if (report.occurredAt !== undefined && report.occurredAt > now + 60000)
        throw new Error("invalid_time")
    if ((await repository.recentCount(reporter, now - 3600000)) >= 10)
        throw new Error("rate_limited")
    return repository.insert({
        ...report,
        reporter,
        status: "new",
        attachments: files,
    })
}
