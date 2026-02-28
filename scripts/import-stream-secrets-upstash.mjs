import fs from 'fs';
import path from 'path';

const ENV_FILE = path.join(process.cwd(), '.env');
const ENV_LOCAL_FILE = path.join(process.cwd(), '.env.local');
const INPUT_FILE = path.join(process.cwd(), 'data', 'private', 'stream-secrets.json');

function parseEnvFile(filePath) {
    if (!fs.existsSync(filePath)) return {};

    const raw = fs.readFileSync(filePath, 'utf-8');
    const entries = {};

    for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const normalized = trimmed.startsWith('export ')
            ? trimmed.slice('export '.length).trim()
            : trimmed;
        const separatorIndex = normalized.indexOf('=');
        if (separatorIndex <= 0) continue;

        const key = normalized.slice(0, separatorIndex).trim();
        let value = normalized.slice(separatorIndex + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        entries[key] = value;
    }

    return entries;
}

function loadEnvFiles() {
    const shellEnvKeys = new Set(Object.keys(process.env));

    const baseEnv = parseEnvFile(ENV_FILE);
    for (const [key, value] of Object.entries(baseEnv)) {
        if (shellEnvKeys.has(key)) continue;
        process.env[key] = value;
    }

    const localEnv = parseEnvFile(ENV_LOCAL_FILE);
    for (const [key, value] of Object.entries(localEnv)) {
        if (shellEnvKeys.has(key)) continue;
        process.env[key] = value;
    }
}

loadEnvFiles();

const REDIS_URL = String(process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL ?? '').trim().replace(/\/+$/, '');
const REDIS_TOKEN = String(process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN ?? '').trim();
const REDIS_PREFIX = String(process.env.ORCASTREAM_STREAM_SECRETS_REDIS_PREFIX ?? 'orcastream:stream-secrets:v1').trim();
const SCOPES = ['channels', 'movies', 'liveEvents'];

function fail(message) {
    console.error(message);
    process.exit(1);
}

function hasAnySecret(entry) {
    if (!entry || typeof entry !== 'object') return false;
    const hls = String(entry.hls ?? '').trim();
    const urlLicense = String(entry.url_license ?? '').trim();
    const headerIptv = String(entry.header_iptv ?? '').trim();
    const headerLicense = String(entry.header_license ?? '').trim();
    return Boolean(hls || urlLicense || headerIptv || headerLicense);
}

async function callUpstashCommand(command) {
    const res = await fetch(REDIS_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${REDIS_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(command),
    });

    if (!res.ok) {
        throw new Error(`Upstash request failed with status ${res.status}`);
    }

    const body = await res.json();
    if (body?.error) {
        throw new Error(body.error);
    }

    return body?.result;
}

function readStore() {
    try {
        const raw = fs.readFileSync(INPUT_FILE, 'utf-8').replace(/^\uFEFF/, '').trim();
        if (!raw) return { version: 1, channels: {}, movies: {}, liveEvents: {} };
        const parsed = JSON.parse(raw);
        return {
            version: 1,
            channels: parsed?.channels ?? {},
            movies: parsed?.movies ?? {},
            liveEvents: parsed?.liveEvents ?? {},
        };
    } catch (error) {
        fail(`Gagal membaca ${INPUT_FILE}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function main() {
    if (!REDIS_URL || !REDIS_TOKEN) {
        fail('UPSTASH_REDIS_REST_URL dan UPSTASH_REDIS_REST_TOKEN wajib diisi.');
    }

    const store = readStore();
    let totalUploaded = 0;

    for (const scope of SCOPES) {
        const redisKey = `${REDIS_PREFIX}:${scope}`;
        const sourceEntries = Object.entries(store[scope] ?? {});
        const entries = sourceEntries.filter(([, value]) => hasAnySecret(value));

        await callUpstashCommand(['DEL', redisKey]);

        let uploaded = 0;
        for (const [id, entry] of entries) {
            await callUpstashCommand(['HSET', redisKey, id, JSON.stringify(entry)]);
            uploaded += 1;
        }

        totalUploaded += uploaded;
        console.log(`[${scope}] uploaded ${uploaded}/${entries.length} entries`);
    }

    console.log(`Done. Total uploaded entries: ${totalUploaded}`);
}

main().catch((error) => {
    fail(`Import gagal: ${error instanceof Error ? error.message : String(error)}`);
});
