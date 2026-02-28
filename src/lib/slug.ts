/**
 * Convert a channel name to a URL-friendly slug.
 * e.g. "R.C.T.I" -> "r-c-t-i", "Trans 7" -> "trans-7"
 */
export function toSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/\./g, '-')        // dots -> dashes
        .replace(/[^a-z0-9-]+/g, '-') // non-alphanumeric -> dashes
        .replace(/-+/g, '-')        // collapse multiple dashes
        .replace(/^-|-$/g, '');     // trim leading/trailing dashes
}

/**
 * Build the watch URL for a channel.
 * e.g. /watch/172/r-c-t-i
 */
export function watchUrl(id: string, name: string): string {
    return `/watch/${id}/${toSlug(name)}`;
}
