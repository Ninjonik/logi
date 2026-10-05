/**
 * The account deletion request is confirmed by typing one's own name (design
 * K1). Surrounding spaces and letter case do not matter; an account without a
 * name cannot be confirmed this way.
 */
export function erasureConfirmationMatches(typed: string, name: string) {
    const expected = name.trim().toLocaleLowerCase()
    return expected.length > 0 && typed.trim().toLocaleLowerCase() === expected
}
