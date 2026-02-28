import fs from 'fs';
import path from 'path';
import { isStatefulWriteSupported } from '@/lib/runtime-storage';

export type StreamSecretScope = 'channels' | 'movies' | 'liveEvents';

export type StreamSecretEntry = {
    hls?: string;
    url_license?: string;
    header_iptv?: string;
    header_license?: string;
    updated_at?: string;
};

type StreamSecretStore = {
    version: 1;
    channels: Record<string, StreamSecretEntry>;
    movies: Record<string, StreamSecretEntry>;
    liveEvents: Record<string, StreamSecretEntry>;
};

const STORE_FILE = path.join(process.cwd(), 'data', 'private', 'stream-secrets.json');
const STORE_JSON_ENV_KEY = 'ORCASTREAM_STREAM_SECRETS_JSON';
const STORE_B64_ENV_KEY = 'ORCASTREAM_STREAM_SECRETS_B64';
const BACKEND_ENV_KEY = 'ORCASTREAM_STREAM_SECRETS_BACKEND';
const REDIS_PREFIX_ENV_KEY = 'ORCASTREAM_STREAM_SECRETS_REDIS_PREFIX';
const DEFAULT_REDIS_PREFIX = 'orcastream:stream-secrets:v1';
const CACHE_TTL_MS = 60_000;
const CIRCUIT_BREAK_MS = 10_000;

type RedisConfig = {
    url: string;
    token: string;
    prefix: string;
};

type StreamSecretCacheEntry = {
    value: StreamSecretEntry | null;
    expiresAt: number;
};

type GlobalStreamSecretState = typeof globalThis & {
    __orcastreamStreamSecretCache?: Map<string, StreamSecretCacheEntry>;
    __orcastreamStreamSecretCircuitOpenUntil?: number;
};

const globalStreamSecretState = globalThis as GlobalStreamSecretState;
const streamSecretCache =
    globalStreamSecretState.__orcastreamStreamSecretCache ??
    (globalStreamSecretState.__orcastreamStreamSecretCache = new Map<string, StreamSecretCacheEntry>());

function createDefaultStore(): StreamSecretStore {
    return {
        version: 1,
        channels: {},
        movies: {},
        liveEvents: {},
    };
}

function normalizeStore(parsed: Partial<StreamSecretStore>): StreamSecretStore {
    return {
        version: 1,
        channels: parsed.channels ?? {},
        movies: parsed.movies ?? {},
        liveEvents: parsed.liveEvents ?? {},
    };
}

function parseStoreFromRaw(raw: string): StreamSecretStore | null {
    const normalizedRaw = raw.replace(/^\uFEFF/, '').trim();
    if (!normalizedRaw) return null;

    try {
        const parsed = JSON.parse(normalizedRaw) as Partial<StreamSecretStore>;
        return normalizeStore(parsed);
    } catch {
        return null;
    }
}

function readStoreFromEnv(): StreamSecretStore | null {
    const rawJson = String(process.env[STORE_JSON_ENV_KEY] ?? '').trim();
    if (rawJson) {
        const fromJson = parseStoreFromRaw(rawJson);
        if (fromJson) return fromJson;
    }

    const rawB64 = String(process.env[STORE_B64_ENV_KEY] ?? '').trim();
    if (rawB64) {
        try {
            const decoded = Buffer.from(rawB64, 'base64').toString('utf-8');
            const fromB64 = parseStoreFromRaw(decoded);
            if (fromB64) return fromB64;
        } catch {
            // ignore invalid base64 payload
        }
    }

    return null;
}

function ensureStoreDir() {
    fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true });
}

function readStoreFromFile(): StreamSecretStore | null {
    try {
        const raw = fs.readFileSync(STORE_FILE, 'utf-8');
        return parseStoreFromRaw(raw);
    } catch {
        return null;
    }
}

function readStoreFallback(): StreamSecretStore {
    return readStoreFromFile() ?? readStoreFromEnv() ?? createDefaultStore();
}

function writeStoreFallback(store: StreamSecretStore) {
    if (!isStatefulWriteSupported()) return;
    ensureStoreDir();
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

function isPresent(value: string | undefined): boolean {
    if (!value) return false;
    return value.trim().length > 0;
}

function hasAnySecret(entry: StreamSecretEntry): boolean {
    return (
        isPresent(entry.hls) ||
        isPresent(entry.url_license) ||
        isPresent(entry.header_iptv) ||
        isPresent(entry.header_license)
    );
}

function getRedisConfig(): RedisConfig | null {
    const backend = String(process.env[BACKEND_ENV_KEY] ?? 'auto').trim().toLowerCase();
    if (backend === 'file') return null;

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

    return {
        url: url.replace(/\/+$/, ''),
        token,
        prefix: String(process.env[REDIS_PREFIX_ENV_KEY] ?? DEFAULT_REDIS_PREFIX).trim() || DEFAULT_REDIS_PREFIX,
    };
}

function getScopeRedisKey(config: RedisConfig, scope: StreamSecretScope): string {
    return `${config.prefix}:${scope}`;
}

function getCacheKey(scope: StreamSecretScope, id: string): string {
    return `${scope}:${id}`;
}

function readCache(scope: StreamSecretScope, id: string): StreamSecretEntry | null | undefined {
    const key = getCacheKey(scope, id);
    const entry = streamSecretCache.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
        streamSecretCache.delete(key);
        return undefined;
    }
    return entry.value;
}

function writeCache(scope: StreamSecretScope, id: string, value: StreamSecretEntry | null) {
    streamSecretCache.set(getCacheKey(scope, id), {
        value,
        expiresAt: Date.now() + CACHE_TTL_MS,
    });
}

function clearScopeCache(scope: StreamSecretScope) {
    const prefix = `${scope}:`;
    for (const key of streamSecretCache.keys()) {
        if (key.startsWith(prefix)) {
            streamSecretCache.delete(key);
        }
    }
}

function isCircuitOpen(): boolean {
    return (globalStreamSecretState.__orcastreamStreamSecretCircuitOpenUntil ?? 0) > Date.now();
}

function openCircuit() {
    globalStreamSecretState.__orcastreamStreamSecretCircuitOpenUntil = Date.now() + CIRCUIT_BREAK_MS;
}

async function callUpstashCommand(
    config: RedisConfig,
    command: Array<string | number>
): Promise<unknown> {
    const res = await fetch(config.url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${config.token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(command),
        cache: 'no-store',
    });

    if (!res.ok) {
        throw new Error(`Upstash request failed with status ${res.status}`);
    }

    const body = await res.json() as { result?: unknown; error?: string };
    if (body.error) {
        throw new Error(body.error);
    }
    return body.result;
}

function parseRedisEntry(raw: unknown): StreamSecretEntry | null {
    if (typeof raw !== 'string' || !raw.trim()) return null;
    try {
        const parsed = JSON.parse(raw) as StreamSecretEntry;
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

function readFallbackEntry(scope: StreamSecretScope, key: string): StreamSecretEntry | null {
    const store = readStoreFallback();
    return store[scope][key] ?? null;
}

function mirrorToLocalStore(scope: StreamSecretScope, key: string, value: StreamSecretEntry | null) {
    if (!isStatefulWriteSupported()) return;
    const store = readStoreFallback();
    if (value) {
        store[scope][key] = value;
    } else {
        delete store[scope][key];
    }
    writeStoreFallback(store);
}

export async function getStreamSecret(scope: StreamSecretScope, id: string): Promise<StreamSecretEntry | null> {
    const key = id.trim();
    if (!key) return null;

    const cached = readCache(scope, key);
    if (cached !== undefined) return cached;

    const redis = getRedisConfig();
    if (redis && !isCircuitOpen()) {
        try {
            const raw = await callUpstashCommand(redis, ['HGET', getScopeRedisKey(redis, scope), key]);
            const parsed = parseRedisEntry(raw);
            writeCache(scope, key, parsed);
            return parsed;
        } catch {
            openCircuit();
        }
    }

    const fallback = readFallbackEntry(scope, key);
    writeCache(scope, key, fallback);
    return fallback;
}

export async function upsertStreamSecret(
    scope: StreamSecretScope,
    id: string,
    patch: Partial<StreamSecretEntry>
): Promise<void> {
    const key = id.trim();
    if (!key) return;

    const current = (await getStreamSecret(scope, key)) ?? {};
    const next: StreamSecretEntry = {
        ...current,
        ...patch,
        updated_at: new Date().toISOString(),
    };

    if (!hasAnySecret(next)) {
        await deleteStreamSecret(scope, key);
        return;
    }

    const redis = getRedisConfig();
    if (redis && !isCircuitOpen()) {
        try {
            await callUpstashCommand(redis, ['HSET', getScopeRedisKey(redis, scope), key, JSON.stringify(next)]);
            mirrorToLocalStore(scope, key, next);
            writeCache(scope, key, next);
            return;
        } catch {
            openCircuit();
        }
    }

    const store = readStoreFallback();
    store[scope][key] = next;
    writeStoreFallback(store);
    writeCache(scope, key, next);
}

export async function deleteStreamSecret(scope: StreamSecretScope, id: string): Promise<void> {
    const key = id.trim();
    if (!key) return;

    const redis = getRedisConfig();
    if (redis && !isCircuitOpen()) {
        try {
            await callUpstashCommand(redis, ['HDEL', getScopeRedisKey(redis, scope), key]);
            mirrorToLocalStore(scope, key, null);
            writeCache(scope, key, null);
            return;
        } catch {
            openCircuit();
        }
    }

    const store = readStoreFallback();
    if (!store[scope][key]) {
        writeCache(scope, key, null);
        return;
    }
    delete store[scope][key];
    writeStoreFallback(store);
    writeCache(scope, key, null);
}

export async function getAllStreamSecrets(scope: StreamSecretScope): Promise<Record<string, StreamSecretEntry>> {
    const redis = getRedisConfig();
    if (redis && !isCircuitOpen()) {
        try {
            const raw = await callUpstashCommand(redis, ['HGETALL', getScopeRedisKey(redis, scope)]);
            if (Array.isArray(raw)) {
                const next: Record<string, StreamSecretEntry> = {};
                for (let i = 0; i < raw.length; i += 2) {
                    const key = String(raw[i] ?? '').trim();
                    if (!key) continue;
                    const entry = parseRedisEntry(raw[i + 1]);
                    if (!entry) continue;
                    next[key] = entry;
                    writeCache(scope, key, entry);
                }
                return next;
            }
        } catch {
            openCircuit();
        }
    }

    const fallback = readStoreFallback();
    return fallback[scope] ?? {};
}

export async function replaceAllStreamSecrets(
    scope: StreamSecretScope,
    entries: Record<string, StreamSecretEntry>
): Promise<void> {
    const sanitizedEntries = Object.fromEntries(
        Object.entries(entries).filter(([key, value]) => key.trim() && hasAnySecret(value))
    );

    const redis = getRedisConfig();
    if (redis && !isCircuitOpen()) {
        try {
            const redisKey = getScopeRedisKey(redis, scope);
            await callUpstashCommand(redis, ['DEL', redisKey]);
            for (const [id, entry] of Object.entries(sanitizedEntries)) {
                await callUpstashCommand(redis, ['HSET', redisKey, id, JSON.stringify(entry)]);
                writeCache(scope, id, entry);
            }
            clearScopeCache(scope);
            for (const [id, entry] of Object.entries(sanitizedEntries)) {
                writeCache(scope, id, entry);
            }
            const localStore = readStoreFallback();
            localStore[scope] = sanitizedEntries;
            writeStoreFallback(localStore);
            return;
        } catch {
            openCircuit();
        }
    }

    const store = readStoreFallback();
    store[scope] = sanitizedEntries;
    writeStoreFallback(store);
    clearScopeCache(scope);
    for (const [id, entry] of Object.entries(sanitizedEntries)) {
        writeCache(scope, id, entry);
    }
}

export function isDistributedStreamSecretStoreEnabled(): boolean {
    return Boolean(getRedisConfig());
}

export function getStreamSecretStoreMode(): 'upstash' | 'file' {
    return getRedisConfig() ? 'upstash' : 'file';
}

export function clearStreamSecretCache() {
    streamSecretCache.clear();
}

// Backward-compatible helper for call sites that expect sync-like "fire and forget".
export function upsertStreamSecretUnsafe(scope: StreamSecretScope, id: string, patch: Partial<StreamSecretEntry>) {
    void upsertStreamSecret(scope, id, patch);
}

// Backward-compatible helper for call sites that expect sync-like "fire and forget".
export function deleteStreamSecretUnsafe(scope: StreamSecretScope, id: string) {
    void deleteStreamSecret(scope, id);
}
