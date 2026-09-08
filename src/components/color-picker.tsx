"use client"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import * as React from "react"

interface ColorPickerProps {
    label: string
    cssVar: string
    value: string
    onChange: (cssVar: string, value: string) => void
}

export function ColorPicker({
    label,
    cssVar,
    value,
    onChange,
}: ColorPickerProps) {
    const [localValue, setLocalValue] = React.useState(value)

    React.useEffect(() => {
        setLocalValue(value)
    }, [value])

    const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newColor = e.target.value
        setLocalValue(newColor)
        onChange(cssVar, newColor)
    }

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value
        setLocalValue(newValue)
        onChange(cssVar, newValue)
    }

    // Get current computed color for display
    const displayColor = React.useMemo(() => {
        if (localValue && localValue.startsWith("#")) {
            return localValue
        }

        // Try to get computed value from CSS
        const computed = getComputedStyle(document.documentElement)
            .getPropertyValue(cssVar)
            .trim()
        if (computed && computed.startsWith("#")) {
            return computed
        }

        return "#000000"
    }, [localValue, cssVar])

    return (
        <div className="space-y-2">
            <Label htmlFor={`color-${cssVar}`} className="text-xs font-medium">
                {label}
            </Label>
            <div className="flex items-start gap-2">
                <div className="relative">
                    <Button
                        type="button"
                        variant="outline"
                        className="h-8 w-8 cursor-pointer overflow-hidden p-0"
                        style={{ backgroundColor: displayColor }}
                    >
                        <input
                            type="color"
                            id={`color-${cssVar}`}
                            value={displayColor}
                            onChange={handleColorChange}
                            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        />
                    </Button>
                </div>
                <Input
                    type="text"
                    placeholder={`${cssVar} value`}
                    value={localValue}
                    onChange={handleTextChange}
                    className="h-8 flex-1 text-xs"
                />
            </div>
        </div>
    )
}
