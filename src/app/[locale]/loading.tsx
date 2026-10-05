import { PublicPageLoading } from "@/components/public/public-page-loading"

/** Public pages load without the dashboard frame; the dashboard has its own. */
export default function Loading() {
    return <PublicPageLoading />
}
