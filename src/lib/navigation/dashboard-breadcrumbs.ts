/** One step of the dashboard breadcrumb trail. */
export type DashboardCrumb = { label: string; href: string; isLast: boolean }

export type DashboardCrumbLabels = {
    /** Shown for the clan segment when the clan's name is not known. */
    workspace: string
    /** Labels of fixed segments inside a clan (`/dashboard/servers/<id>/…`). */
    segments: Readonly<Record<string, string>>
    /** Labels of fixed segments of global pages (`/dashboard/<segment>`). */
    globalSegments: Readonly<Record<string, string>>
    /** Labels of the settings topics (`…/settings/<section>`). */
    settingsSections: Readonly<Record<string, string>>
    /** Label of a record ID, by the segment it follows (`events` → "Event"). */
    records: Readonly<Record<string, string>>
    /** Label of any other record ID or unknown segment. */
    detail: string
}

/** Segments that only group routes and have no page of their own. */
const STRUCTURAL = new Set(["dashboard", "servers"])
/** Global segments without a page, skipped so no crumb links to a 404. */
const GLOBAL_STRUCTURAL = new Set(["settings"])

const own = (record: Readonly<Record<string, string>>, key: string) =>
    Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined

/**
 * Builds the breadcrumb trail of a dashboard path. Fixed segments get their
 * translated label, the clan segment its name, and record IDs (Convex or
 * Discord) a label naming the kind of record, never the raw ID or slug.
 */
export function buildDashboardBreadcrumbs({
    locale,
    pathname,
    serverId,
    serverName,
    labels,
}: {
    locale: string
    pathname: string
    serverId?: string
    serverName?: string
    labels: DashboardCrumbLabels
}): DashboardCrumb[] {
    const segments = pathname.split("?")[0].split("/").filter(Boolean).slice(1)
    const inWorkspace = segments[1] === "servers"
    const crumbs: Array<{ label: string; href: string }> = []
    let href = `/${locale}`

    segments.forEach((raw, index) => {
        href += `/${raw}`
        const segment = safeDecode(raw)
        const previous = index > 0 ? safeDecode(segments[index - 1]) : ""
        if (STRUCTURAL.has(segment) && index <= 1) return
        if (!inWorkspace && index === 1 && GLOBAL_STRUCTURAL.has(segment))
            return
        crumbs.push({
            label: labelFor({
                segment,
                previous,
                index,
                inWorkspace,
                serverId,
                serverName,
                labels,
            }),
            href,
        })
    })

    return crumbs.map((crumb, index) => ({
        ...crumb,
        isLast: index === crumbs.length - 1,
    }))
}

function labelFor({
    segment,
    previous,
    index,
    inWorkspace,
    serverId,
    serverName,
    labels,
}: {
    segment: string
    previous: string
    index: number
    inWorkspace: boolean
    serverId?: string
    serverName?: string
    labels: DashboardCrumbLabels
}): string {
    if (inWorkspace && index === 2)
        return segment === serverId && serverName
            ? serverName
            : labels.workspace
    if (previous === "settings" && own(labels.settingsSections, segment))
        return own(labels.settingsSections, segment) as string
    const fixed = inWorkspace
        ? own(labels.segments, segment)
        : (own(labels.globalSegments, segment) ?? own(labels.segments, segment))
    if (fixed) return fixed
    const record = own(labels.records, previous)
    if (record) return record
    // A route added without a label still reads as words, never as an ID.
    return RECORD_ID.test(segment) ? labels.detail : humanize(segment)
}

/** Convex document IDs and Discord snowflakes. */
const RECORD_ID = /^(?:[a-z0-9]{16,}|\d{15,21})$/

function humanize(segment: string): string {
    const words = segment.replace(/[-_]+/g, " ").trim()
    return words ? words[0].toUpperCase() + words.slice(1) : segment
}

function safeDecode(segment: string): string {
    try {
        return decodeURIComponent(segment)
    } catch {
        return segment
    }
}
