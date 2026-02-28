export function isStatefulWriteSupported(): boolean {
    // Vercel functions are ephemeral and do not provide durable local disk writes.
    if (process.env.VERCEL && process.env.ORCASTREAM_ALLOW_EPHEMERAL_WRITES !== 'true') {
        return false;
    }
    return true;
}
