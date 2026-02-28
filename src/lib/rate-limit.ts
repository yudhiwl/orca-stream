type RateLimitInput = {
    namespace: string;
    identifier: string;
    limit: number;
    windowSeconds: number;
};

type RateLimitResult = {
    allowed: boolean;
    count: number;
    limit: number;
    retryAfterSeconds: number;
    provider: 'upstash' | 'memory';
};

type MemoryEntry = {
    count: number;
    expiresAt: number;
};

type GlobalRateLimitState = typeof globalThis & {
    __orcastreamRateLimitMemory?: Map<string, MemoryEntry>;
};

const globalRateLimitState = globalThis as GlobalRateLimitState;
const memoryStore =
    globalRateLimitState.__orcastreamRateLimitMemory ??
    (globalRateLimitState.__orcastreamRateLimitMemory = new Map<string, MemoryEntry>());

function getRedisConfig() {
    const url = String(
        process.env.UPSTASH_REDIS_REST_URL
        ?? process.env.KV_REST_API_URL
        ?? ''
    ).trim();
    const token = String(
        process.env.UPSTASH_REDIS_REST_TOKEN
        ?? process.env.KV_REST_API_TOKEN
        ?? ''
    ).trim();

    if (!url || !token) return null;
    return { url: url.replace(/\/+$/, ''), token };
}

function getWindow(nowMs: number, windowSeconds: number) {
    const nowSec = Math.floor(nowMs / 1000);
    const windowStartSec = Math.floor(nowSec / windowSeconds) * windowSeconds;
    const windowEndSec = windowStartSec + windowSeconds;
    const retryAfterSeconds = Math.max(1, windowEndSec - nowSec);
    return { windowStartSec, retryAfterSeconds };
}

async function callUpstashCommand(config: { url: string; token: string }, ...parts: Array<string | number>) {
    const path = parts.map((part) => encodeURIComponent(String(part))).join('/');
    const res = await fetch(`${config.url}/${path}`, {
        headers: {
            Authorization: `Bearer ${config.token}`,
        },
        cache: 'no-store',
    });

    if (!res.ok) {
        throw new Error(`Upstash request failed with status ${res.status}`);
    }

    const body = await res.json() as { result?: unknown };
    return body.result;
}

function pruneMemoryStore(nowMs: number) {
    if (memoryStore.size < 2048) return;
    for (const [key, value] of memoryStore.entries()) {
        if (value.expiresAt <= nowMs) {
            memoryStore.delete(key);
        }
    }
}

function checkMemoryRateLimit(input: RateLimitInput, nowMs: number): RateLimitResult {
    pruneMemoryStore(nowMs);
    const { windowStartSec, retryAfterSeconds } = getWindow(nowMs, input.windowSeconds);
    const key = `${input.namespace}:${windowStartSec}:${input.identifier}`;
    const expiresAt = (windowStartSec + input.windowSeconds) * 1000;

    const current = memoryStore.get(key);
    const nextCount = current ? current.count + 1 : 1;
    memoryStore.set(key, { count: nextCount, expiresAt });

    return {
        allowed: nextCount <= input.limit,
        count: nextCount,
        limit: input.limit,
        retryAfterSeconds,
        provider: 'memory',
    };
}

export async function checkRateLimit(input: RateLimitInput): Promise<RateLimitResult> {
    const nowMs = Date.now();
    const { windowStartSec, retryAfterSeconds } = getWindow(nowMs, input.windowSeconds);
    const key = `${input.namespace}:${windowStartSec}:${input.identifier}`;

    const redisConfig = getRedisConfig();
    if (!redisConfig) {
        return checkMemoryRateLimit(input, nowMs);
    }

    try {
        const countRaw = await callUpstashCommand(redisConfig, 'incr', key);
        const count = Number(countRaw);
        const safeCount = Number.isFinite(count) ? count : input.limit + 1;

        if (safeCount === 1) {
            // Keep key only for this window (+ small buffer to avoid race).
            await callUpstashCommand(redisConfig, 'expire', key, input.windowSeconds + 5);
        }

        return {
            allowed: safeCount <= input.limit,
            count: safeCount,
            limit: input.limit,
            retryAfterSeconds,
            provider: 'upstash',
        };
    } catch {
        // Graceful fallback so API keeps running if Upstash is temporarily unavailable.
        return checkMemoryRateLimit(input, nowMs);
    }
}
