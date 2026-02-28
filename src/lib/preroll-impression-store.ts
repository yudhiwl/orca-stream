import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { isStatefulWriteSupported } from '@/lib/runtime-storage';

type PrerollStore = {
    version: 1;
    impressions: Record<string, string>;
};

const STORE_FILE = path.join(process.cwd(), 'data', 'private', 'preroll-impressions.json');
const RETENTION_DAYS = 3;

type GlobalPrerollStoreState = typeof globalThis & {
    __orcastreamPrerollStore?: PrerollStore;
};

const globalPrerollStoreState = globalThis as GlobalPrerollStoreState;

function createDefaultStore(): PrerollStore {
    return {
        version: 1,
        impressions: {},
    };
}

function ensureStoreDir() {
    fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true });
}

function readInMemoryStore(): PrerollStore {
    const store = globalPrerollStoreState.__orcastreamPrerollStore;
    if (store) return store;

    const created = createDefaultStore();
    globalPrerollStoreState.__orcastreamPrerollStore = created;
    return created;
}

function writeInMemoryStore(store: PrerollStore) {
    globalPrerollStoreState.__orcastreamPrerollStore = store;
}

function readStore(): PrerollStore {
    if (!isStatefulWriteSupported()) {
        return readInMemoryStore();
    }

    try {
        const raw = fs.readFileSync(STORE_FILE, 'utf-8').replace(/^\uFEFF/, '').trim();
        if (!raw) return createDefaultStore();

        const parsed = JSON.parse(raw) as Partial<PrerollStore>;
        return {
            version: 1,
            impressions: parsed.impressions ?? {},
        };
    } catch {
        return createDefaultStore();
    }
}

function writeStore(store: PrerollStore) {
    if (!isStatefulWriteSupported()) {
        writeInMemoryStore(store);
        return;
    }

    ensureStoreDir();
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

function formatJakartaDate(date: Date): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    return formatter.format(date);
}

function buildImpressionKey(ip: string, day: string): string {
    return crypto.createHash('sha256').update(`${ip}|${day}`).digest('hex');
}

function pruneOldEntries(store: PrerollStore, now = new Date()) {
    const minAllowed = new Date(now);
    minAllowed.setDate(minAllowed.getDate() - RETENTION_DAYS);
    const minAllowedIso = minAllowed.toISOString();

    for (const [key, createdAt] of Object.entries(store.impressions)) {
        if (!createdAt || createdAt < minAllowedIso) {
            delete store.impressions[key];
        }
    }
}

export function hasSeenPrerollToday(ip: string, now = new Date()): boolean {
    const sanitizedIp = ip.trim();
    if (!sanitizedIp) return false;

    const store = readStore();
    pruneOldEntries(store, now);
    const day = formatJakartaDate(now);
    const key = buildImpressionKey(sanitizedIp, day);
    return Boolean(store.impressions[key]);
}

export function markPrerollSeenToday(ip: string, now = new Date()) {
    const sanitizedIp = ip.trim();
    if (!sanitizedIp) return;

    const store = readStore();
    pruneOldEntries(store, now);

    const day = formatJakartaDate(now);
    const key = buildImpressionKey(sanitizedIp, day);
    store.impressions[key] = now.toISOString();

    writeStore(store);
}
