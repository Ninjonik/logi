import { z } from "zod"

import { githubConfig, installationToken } from "./app-auth"
export { githubConfig } from "./app-auth"

export const issueSchema = z.object({
    number: z.number().int().positive(),
    html_url: z.url(),
    state: z.enum(["open", "closed"]),
    updated_at: z.string(),
})
export const commentsSchema = z.array(
    z.object({
        id: z.number(),
        body: z.string(),
        user: z.object({ login: z.string() }).nullable(),
        html_url: z.url(),
    })
)
export async function githubRequest(
    path: string,
    method = "GET",
    body?: unknown
) {
    const config = githubConfig()
    if (!config) throw new Error("GitHub integration is disabled")
    const token = await installationToken(config)
    const response = await fetch(
        `https://api.github.com/repos/${config.repository}/${path}`,
        {
            method,
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "Content-Type": "application/json",
            },
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: AbortSignal.timeout(20000),
        }
    )
    if (!response.ok)
        throw new Error(`GitHub request failed (${response.status})`)
    return response.json() as Promise<unknown>
}

/** Walk all pages so retry markers and recent discussion are not lost after 100 comments. */
export async function githubComments(number: number) {
    const comments: z.infer<typeof commentsSchema> = []
    for (let page = 1; ; page++) {
        const batch = commentsSchema.parse(
            await githubRequest(
                `issues/${number}/comments?per_page=100&page=${page}`
            )
        )
        comments.push(...batch)
        if (batch.length < 100) return comments
    }
}

export const githubIssuePort: import("../../application/bug-reports/sync-github").GithubIssuePort =
    {
        async findOrCreate(marker, title, body) {
            for (let page = 1; ; page++) {
                const issues = z
                    .array(issueSchema.extend({ body: z.string().nullable() }))
                    .parse(
                        await githubRequest(
                            `issues?state=all&per_page=100&page=${page}`
                        )
                    )
                const found = issues.find((issue) =>
                    issue.body?.startsWith(marker)
                )
                if (found) return found
                if (issues.length < 100) break
            }
            return issueSchema.parse(
                await githubRequest("issues", "POST", { title, body })
            )
        },
        async setState(number, state) {
            await githubRequest(`issues/${number}`, "PATCH", { state })
        },
        async commentOnce(number, marker, body) {
            if (
                !(await githubComments(number)).some((c) =>
                    c.body.includes(marker)
                )
            )
                await githubRequest(`issues/${number}/comments`, "POST", {
                    body,
                })
        },
    }
