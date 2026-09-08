import * as React from "react"

interface LogoProps extends Omit<
    React.ImgHTMLAttributes<HTMLImageElement>,
    "src"
> {
    size?: number
}

export function Logo({ size = 24, className, ...props }: LogoProps) {
    return (
        <img
            src="/favicon.svg"
            alt="Logi"
            width={size}
            height={size}
            className={className}
            {...props}
        />
    )
}
