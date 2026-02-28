import fs from 'fs';
import path from 'path';

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

function readStore(): StreamSecretStore {
    try {
        const raw = fs.readFileSync(STORE_FILE, 'utf-8');
        const fromFile = parseStoreFromRaw(raw);
        if (fromFile) return fromFile;
    } catch {
        // fallback below
    }

    return readStoreFromEnv() ?? createDefaultStore();
}

function writeStore(store: StreamSecretStore) {
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

export function getStreamSecret(scope: StreamSecretScope, id: string): StreamSecretEntry | null {
    const key = id.trim();
    if (!key) return null;

    const store = readStore();
    return store[scope][key] ?? null;
}

export function upsertStreamSecret(scope: StreamSecretScope, id: string, patch: Partial<StreamSecretEntry>) {
    const key = id.trim();
    if (!key) return;

    const store = readStore();
    const current = store[scope][key] ?? {};
    const next: StreamSecretEntry = {
        ...current,
        ...patch,
        updated_at: new Date().toISOString(),
    };

    if (!hasAnySecret(next)) {
        delete store[scope][key];
    } else {
        store[scope][key] = next;
    }

    writeStore(store);
}

export function deleteStreamSecret(scope: StreamSecretScope, id: string) {
    const key = id.trim();
    if (!key) return;

    const store = readStore();
    if (!store[scope][key]) return;

    delete store[scope][key];
    writeStore(store);
}
