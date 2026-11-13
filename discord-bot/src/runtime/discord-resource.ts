/** Only the resource's explicit Unknown-* code proves that it is absent. */
export function missingDiscordResource(code: number) {
    return (error: unknown): null => {
        if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === code
        )
            return null
        throw error
    }
}
