import { githubState, issueBody } from "../../domain/bug-reports/github"
import type { Report } from "../../domain/bug-reports/report"

type LinkedReport = Report & {
    githubNumber?: number
    githubRepository?: string
    githubRevision?: number
}
export interface GithubIssuePort {
    findOrCreate(
        marker: string,
        title: string,
        body: string
    ): Promise<{ number: number; html_url: string }>
    setState(number: number, state: "open" | "closed"): Promise<void>
    commentOnce(number: number, marker: string, body: string): Promise<void>
}
export async function syncGithubReport(
    report: LinkedReport,
    repository: string,
    github: GithubIssuePort
) {
    if (report.githubRepository && report.githubRepository !== repository)
        throw new Error("Linked repository differs from configuration")
    if (!report.githubNumber) {
        const issue = await github.findOrCreate(
            `<!-- logi-report:${report._id} -->`,
            report.title,
            issueBody(report)
        )
        // Persist the recovered/created identity before attempting additional effects.
        return { number: issue.number, url: issue.html_url, revision: -1 }
    }
    await github.setState(report.githubNumber, githubState(report.status))
    const marker = `<!-- logi-status:${report._id}:${report.githubRevision ?? 0} -->`
    await github.commentOnce(
        report.githubNumber,
        marker,
        `${marker}\nLogi status: **${report.status}**.`
    )
    return {
        number: report.githubNumber,
        url: report.githubUrl,
        revision: report.githubRevision ?? 0,
    }
}
