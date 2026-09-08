import { connection } from "next/server"
import { Suspense } from "react"

async function ConnectionMarker() {
    await connection()
    return null
}

/** Allows runtime metadata from public Convex reads while cached profile content
 * remains independently long-lived and tag-revalidated. */
export function DynamicMetadataMarker() {
    return (
        <Suspense>
            <ConnectionMarker />
        </Suspense>
    )
}
