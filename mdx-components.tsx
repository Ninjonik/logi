import { useMDXComponents as useDocsThemeComponents } from "nextra-theme-docs"

export function useMDXComponents(components = {}) {
    return {
        ...useDocsThemeComponents(components),
    }
}
