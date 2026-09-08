"use client"

import {
    sidebarVariants,
    sidebarCollapsibleOptions,
    sidebarSideOptions,
} from "@/config/theme-customizer-constants"
import { useSidebarConfig } from "@/contexts/sidebar-context"
import { Separator } from "@/components/ui/separator"
import { useSidebar } from "@/components/ui/sidebar"
import { Label } from "@/components/ui/label"

export function LayoutTab() {
    const { config: sidebarConfig, updateConfig: updateSidebarConfig } =
        useSidebarConfig()
    const { toggleSidebar, state: sidebarState } = useSidebar()

    // Sidebar handler functions
    const handleSidebarVariantSelect = (
        variant: "sidebar" | "floating" | "inset"
    ) => {
        updateSidebarConfig({ variant })
    }

    const handleSidebarCollapsibleSelect = (
        collapsible: "offcanvas" | "icon" | "none"
    ) => {
        updateSidebarConfig({ collapsible })

        // If switching to icon mode and sidebar is currently expanded, auto-collapse it
        if (collapsible === "icon" && sidebarState === "expanded") {
            toggleSidebar()
        }
    }

    const handleSidebarSideSelect = (side: "left" | "right") => {
        updateSidebarConfig({ side })
    }

    return (
        <div className="space-y-6 p-4">
            {/* Sidebar Configuration */}
            <div className="space-y-3">
                {/* Sidebar Variant */}
                <div>
                    <Label className="text-sm font-medium">
                        Sidebar Variant
                    </Label>
                    {sidebarConfig.variant && (
                        <p className="text-muted-foreground mt-1 text-xs">
                            {sidebarConfig.variant === "sidebar" &&
                                "Default: Standard sidebar layout"}
                            {sidebarConfig.variant === "floating" &&
                                "Floating: Floating sidebar with border"}
                            {sidebarConfig.variant === "inset" &&
                                "Inset: Inset sidebar with rounded corners"}
                        </p>
                    )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                    {sidebarVariants.map((variant) => (
                        <div
                            key={variant.value}
                            className={`relative cursor-pointer rounded-md border p-4 transition-colors ${
                                sidebarConfig.variant === variant.value
                                    ? "border-primary bg-primary/10"
                                    : "border-border hover:border-border/60"
                            }`}
                            onClick={() =>
                                handleSidebarVariantSelect(
                                    variant.value as
                                        "sidebar" | "floating" | "inset"
                                )
                            }
                        >
                            {/* Visual representation of sidebar variant */}
                            <div className="space-y-2">
                                <div className="text-center text-xs font-semibold">
                                    {variant.name}
                                </div>
                                <div
                                    className={`flex h-12 rounded border ${variant.value === "inset" ? "bg-muted" : "bg-background"}`}
                                >
                                    {/* Sidebar representation - smaller and more proportional */}
                                    <div
                                        className={`bg-muted flex w-3 flex-shrink-0 flex-col gap-0.5 p-1 ${
                                            variant.value === "floating"
                                                ? "m-1 rounded border-r"
                                                : variant.value === "inset"
                                                  ? "bg-muted/80 m-1 ms-0 rounded"
                                                  : "border-r"
                                        }`}
                                    >
                                        {/* Menu icon representations - clearer and more visible */}
                                        <div className="bg-foreground/60 h-0.5 w-full rounded"></div>
                                        <div className="bg-foreground/50 h-0.5 w-3/4 rounded"></div>
                                        <div className="bg-foreground/40 h-0.5 w-2/3 rounded"></div>
                                        <div className="bg-foreground/30 h-0.5 w-3/4 rounded"></div>
                                    </div>
                                    {/* Main content area - larger and more prominent */}
                                    <div
                                        className={`flex-1 ${variant.value === "inset" ? "bg-background ms-0" : "bg-background/50"} border-muted-foreground/20 m-1 rounded-sm border border-dashed`}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <Separator />

            {/* Sidebar Collapsible Mode */}
            <div className="space-y-3">
                <div>
                    <Label className="text-sm font-medium">
                        Sidebar Collapsible Mode
                    </Label>
                    {sidebarConfig.collapsible && (
                        <p className="text-muted-foreground mt-1 text-xs">
                            {sidebarConfig.collapsible === "offcanvas" &&
                                "Off Canvas: Slides out of view"}
                            {sidebarConfig.collapsible === "icon" &&
                                "Icon: Collapses to icon only"}
                            {sidebarConfig.collapsible === "none" &&
                                "None: Always visible"}
                        </p>
                    )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                    {sidebarCollapsibleOptions.map((option) => (
                        <div
                            key={option.value}
                            className={`relative cursor-pointer rounded-md border p-4 transition-colors ${
                                sidebarConfig.collapsible === option.value
                                    ? "border-primary bg-primary/10"
                                    : "border-border hover:border-border/60"
                            }`}
                            onClick={() =>
                                handleSidebarCollapsibleSelect(
                                    option.value as
                                        "offcanvas" | "icon" | "none"
                                )
                            }
                        >
                            {/* Visual representation of collapsible mode */}
                            <div className="space-y-2">
                                <div className="text-center text-xs font-semibold">
                                    {option.name}
                                </div>
                                <div className="bg-background flex h-12 rounded border">
                                    {/* Sidebar representation based on collapsible mode */}
                                    {option.value === "offcanvas" ? (
                                        // Off-canvas: Show collapsed state with hamburger menu
                                        <div className="bg-background/50 border-muted-foreground/20 m-1 flex flex-1 items-center justify-start rounded-sm border border-dashed pl-2">
                                            <div className="flex flex-col gap-0.5">
                                                <div className="bg-foreground/60 h-0.5 w-3 rounded"></div>
                                                <div className="bg-foreground/60 h-0.5 w-3 rounded"></div>
                                                <div className="bg-foreground/60 h-0.5 w-3 rounded"></div>
                                            </div>
                                        </div>
                                    ) : option.value === "icon" ? (
                                        // Icon mode: Show thin icon sidebar with clear icons
                                        <>
                                            <div className="bg-muted flex w-4 flex-shrink-0 flex-col items-center gap-1 border-r p-1">
                                                <div className="bg-foreground/60 h-2 w-2 rounded-sm"></div>
                                                <div className="bg-foreground/40 h-2 w-2 rounded-sm"></div>
                                                <div className="bg-foreground/30 h-2 w-2 rounded-sm"></div>
                                            </div>
                                            <div className="bg-background/50 border-muted-foreground/20 m-1 flex-1 rounded-sm border border-dashed"></div>
                                        </>
                                    ) : (
                                        // None: Always show full sidebar - more proportional
                                        <>
                                            <div className="bg-muted flex w-6 flex-shrink-0 flex-col gap-0.5 border-r p-1">
                                                <div className="bg-foreground/60 h-0.5 w-full rounded"></div>
                                                <div className="bg-foreground/50 h-0.5 w-3/4 rounded"></div>
                                                <div className="bg-foreground/40 h-0.5 w-2/3 rounded"></div>
                                                <div className="bg-foreground/30 h-0.5 w-3/4 rounded"></div>
                                            </div>
                                            <div className="bg-background/50 border-muted-foreground/20 m-1 flex-1 rounded-sm border border-dashed"></div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <Separator />

            {/* Sidebar Side */}
            <div className="space-y-3">
                <div>
                    <Label className="text-sm font-medium">
                        Sidebar Position
                    </Label>
                    {sidebarConfig.side && (
                        <p className="text-muted-foreground mt-1 text-xs">
                            {sidebarConfig.side === "left" &&
                                "Left: Sidebar positioned on the left side"}
                            {sidebarConfig.side === "right" &&
                                "Right: Sidebar positioned on the right side"}
                        </p>
                    )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                    {sidebarSideOptions.map((side) => (
                        <div
                            key={side.value}
                            className={`relative cursor-pointer rounded-md border p-4 transition-colors ${
                                sidebarConfig.side === side.value
                                    ? "border-primary bg-primary/10"
                                    : "border-border hover:border-border/60"
                            }`}
                            onClick={() =>
                                handleSidebarSideSelect(
                                    side.value as "left" | "right"
                                )
                            }
                        >
                            {/* Visual representation of sidebar side */}
                            <div className="space-y-2">
                                <div className="text-center text-xs font-semibold">
                                    {side.name}
                                </div>
                                <div className="bg-background flex h-12 rounded border">
                                    {side.value === "left" ? (
                                        // Left sidebar layout - more proportional
                                        <>
                                            <div className="bg-muted flex w-6 flex-shrink-0 flex-col gap-0.5 border-r p-1">
                                                <div className="bg-foreground/60 h-0.5 w-full rounded"></div>
                                                <div className="bg-foreground/50 h-0.5 w-3/4 rounded"></div>
                                                <div className="bg-foreground/40 h-0.5 w-2/3 rounded"></div>
                                                <div className="bg-foreground/30 h-0.5 w-3/4 rounded"></div>
                                            </div>
                                            <div className="bg-background/50 border-muted-foreground/20 m-1 flex-1 rounded-sm border border-dashed"></div>
                                        </>
                                    ) : (
                                        // Right sidebar layout - more proportional
                                        <>
                                            <div className="bg-background/50 border-muted-foreground/20 m-1 flex-1 rounded-sm border border-dashed"></div>
                                            <div className="bg-muted flex w-6 flex-shrink-0 flex-col gap-0.5 border-l p-1">
                                                <div className="bg-foreground/60 h-0.5 w-full rounded"></div>
                                                <div className="bg-foreground/50 h-0.5 w-3/4 rounded"></div>
                                                <div className="bg-foreground/40 h-0.5 w-2/3 rounded"></div>
                                                <div className="bg-foreground/30 h-0.5 w-3/4 rounded"></div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
