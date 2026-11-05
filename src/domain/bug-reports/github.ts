import type { Report } from "./report"

export function githubState(status: Report["status"]) {
    return status === "resolved" ? "closed" : "open"
}
export function reportState(
    state: "open" | "closed",
    current: Report["status"]
) {
    return state === "closed"
        ? "resolved"
        : current === "resolved"
          ? "new"
          : current
}
export function issueBody(
    report: Pick<Report, "_id" | "message" | "server" | "occurredAt">
) {
    return `<!-- logi-report:${report._id} -->\n${report.message}\n\nServer context: ${report.server || "Not supplied"}\nIncident time: ${report.occurredAt === undefined ? "Not supplied" : new Date(report.occurredAt).toISOString()}\n\nAttachments and reporter identity are available only in the Logi superadmin inbox.`
}
