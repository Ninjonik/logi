/** REST pagination avoids the gateway's full-member-request rate limit on repeated checks. */
export async function listReportMembers<T extends { id: string }>(
    load: (after?: string) => Promise<T[]>
): Promise<T[]> {
    const members = new Map<string, T>()
    let after: string | undefined
    for (let page = 0; page < 10; page++) {
        const values = await load(after)
        for (const member of values) members.set(member.id, member)
        if (values.length < 1000) return [...members.values()]
        const next = values.at(-1)?.id
        if (!next || next === after)
            throw Error("member_pagination_unavailable")
        after = next
    }
    // Incomplete staff/reader enumeration cannot prove ticket privacy.
    throw Error("member_inventory_too_large")
}
