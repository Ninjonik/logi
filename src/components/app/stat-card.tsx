import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function StatCard({
    title,
    value,
    description,
    icon: Icon,
    className,
}: {
    title: string
    value: string | number
    description: string
    icon: LucideIcon
    className?: string
}) {
    return (
        <Card className={cn("border-border/60 rounded-2xl", className)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-muted-foreground text-sm font-medium">
                    {title}
                </CardTitle>
                <Icon className="text-muted-foreground size-4" />
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-semibold">{value}</div>
                <p className="text-muted-foreground mt-2 text-sm">
                    {description}
                </p>
            </CardContent>
        </Card>
    )
}
