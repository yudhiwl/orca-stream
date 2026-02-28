import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Channel } from '@/types/channel';
import { LiveEvent } from '@/types/live-event';
import { isLiveEventWatchId, toLiveEventSourceId, toLiveEventWatchId } from '@/lib/live-event-id';
import { getStreamSecret, StreamSecretScope } from '@/lib/stream-secret-store';

const CHANNELS_FILE = path.join(process.cwd(), 'src', 'data', 'channels.json');
const MOVIE_FILE = path.join(process.cwd(), 'src', 'data', 'movie.json');
const LIVE_EVENTS_FILE = path.join(process.cwd(), 'src', 'data', 'live-events.json');

const TOKEN_TTL_MS = 5 * 60 * 1000;

type ProxyTokenPayload = {
    kind: 'proxy';
    proxyHeaders: Record<string, string>;
};

type WidevineLicenseTokenPayload = {
    kind: 'widevine-license';
    licenseUrl: string;
    licenseHeaders: Record<string, string>;
};

type ClearKeyLicenseTokenPayload = {
    kind: 'clearkey-license';
    clearKeyPayload: string;
};

type PlaybackTokenPayload =
    | ProxyTokenPayload
    | WidevineLicenseTokenPayload
    | ClearKeyLicenseTokenPayload;

type StoredPlaybackToken = PlaybackTokenPayload & {
    expiresAt: number;
};

type GlobalPlaybackTokenState = typeof globalThis & {
    __orcastreamPlaybackTokens?: Map<string, StoredPlaybackToken>;
};

const globalPlaybackState = globalThis as GlobalPlaybackTokenState;
const playbackTokenStore =
    globalPlaybackState.__orcastreamPlaybackTokens ??
    (globalPlaybackState.__orcastreamPlaybackTokens = new Map<string, StoredPlaybackToken>());

function readJsonFile<T>(filePath: string, fallback: T): T {
    try {
        const raw = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '').trim();
        if (!raw) return fallback;
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

function pruneExpiredTokens(now: number) {
    for (const [token, payload] of playbackTokenStore.entries()) {
        if (payload.expiresAt <= now) {
            playbackTokenStore.delete(token);
        }
    }
}

function mapLiveEventToChannel(event: LiveEvent): Channel {
    const watchId = toLiveEventWatchId(event.id);
    return {
        id: watchId,
        name: event.title,
        namespace: `event-${watchId}`,
        image: event.thumbnail || '',
        hls: event.hls,
        jenis: event.jenis,
        category: event.sport,
        tagline: event.competition || '',
        is_live: event.is_live,
        header_iptv: event.header_iptv || '',
        url_license: event.url_license || '',
        country_name: 'Live Sports',
        alpha_2_code: 'EV',
        premium: 'f',
        fake_event: 'f',
        t_stamp: event.t_stamp || 'none',
        s_stamp: event.s_stamp || 'none',
        is_movie: 'f',
        subtitle: '',
        header_license: event.header_license || '',
    };
}

async function withChannelSecrets(scope: StreamSecretScope, sourceId: string, channel: Channel): Promise<Channel> {
    const secrets = await getStreamSecret(scope, sourceId);
    if (!secrets) return channel;

    return {
        ...channel,
        hls: secrets.hls ?? channel.hls,
        url_license: secrets.url_license ?? channel.url_license,
        header_iptv: secrets.header_iptv ?? channel.header_iptv,
        header_license: secrets.header_license ?? channel.header_license,
    };
}

export function sanitizeChannelForClient(channel: Channel): Channel {
    return {
        ...channel,
        hls: '',
        url_license: '',
        header_iptv: '',
        header_license: '',
    };
}

export function sanitizeChannelsForClient(channels: Channel[]): Channel[] {
    return channels.map(sanitizeChannelForClient);
}

export function sanitizeLiveEventForClient(event: LiveEvent): LiveEvent {
    return {
        ...event,
        hls: '',
        url_license: '',
        header_iptv: '',
        header_license: '',
    };
}

export function sanitizeLiveEventsForClient(events: LiveEvent[]): LiveEvent[] {
    return events.map(sanitizeLiveEventForClient);
}

export function readChannelsData(): Channel[] {
    const parsed = readJsonFile<unknown>(CHANNELS_FILE, []);
    return Array.isArray(parsed) ? (parsed as Channel[]) : [];
}

export function readMovieChannelsData(): Channel[] {
    const parsed = readJsonFile<{ info?: Channel[] }>(MOVIE_FILE, { info: [] });
    return Array.isArray(parsed.info) ? parsed.info : [];
}

export function readLiveEventsData(): LiveEvent[] {
    const parsed = readJsonFile<unknown>(LIVE_EVENTS_FILE, []);
    return Array.isArray(parsed) ? (parsed as LiveEvent[]) : [];
}

export async function resolveChannelForPlayback(channelId: string): Promise<Channel | null> {
    const id = channelId.trim();
    if (!id) return null;

    const channels = readChannelsData();
    const tvChannel = channels.find((item) => item.id === id);
    if (tvChannel) return withChannelSecrets('channels', tvChannel.id, tvChannel);

    const movieChannels = readMovieChannelsData();
    const movieChannel = movieChannels.find((item) => item.id === id);
    if (movieChannel) return withChannelSecrets('movies', movieChannel.id, movieChannel);

    const events = readLiveEventsData();
    if (isLiveEventWatchId(id)) {
        const sourceId = toLiveEventSourceId(id);
        const event = events.find((item) => item.id === id || item.id === sourceId);
        if (!event) return null;
        return withChannelSecrets('liveEvents', event.id, mapLiveEventToChannel(event));
    }

    const legacyEvent = events.find((item) => item.id === id);
    return legacyEvent ? withChannelSecrets('liveEvents', legacyEvent.id, mapLiveEventToChannel(legacyEvent)) : null;
}

function parseHeaderObject(input: string): Record<string, string> | null {
    try {
        const parsed = JSON.parse(input) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
        return Object.fromEntries(
            Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [key, String(value ?? '')])
        );
    } catch {
        return null;
    }
}

function extractFirstJsonObject(input: string): string | null {
    const start = input.indexOf('{');
    if (start < 0) return null;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < input.length; i += 1) {
        const ch = input[i];

        if (escaped) {
            escaped = false;
            continue;
        }
        if (ch === '\\') {
            escaped = true;
            continue;
        }
        if (ch === '"') {
            inString = !inString;
            continue;
        }
        if (inString) continue;

        if (ch === '{') depth += 1;
        if (ch === '}') {
            depth -= 1;
            if (depth === 0) {
                return input.slice(start, i + 1);
            }
        }
    }

    return null;
}

export function parseHeaderBlob(raw: string): Record<string, string> {
    if (!raw) return {};

    const candidates = [raw, raw.replace(/\\"/g, '"')];
    let parsed: Record<string, string> | null = null;

    for (const candidate of candidates) {
        parsed = parseHeaderObject(candidate);
        if (parsed) break;

        const objectCandidate = extractFirstJsonObject(candidate);
        if (!objectCandidate) continue;

        parsed = parseHeaderObject(objectCandidate);
        if (parsed) break;
    }

    if (!parsed) {
        return {};
    }

    return Object.fromEntries(
        Object.entries(parsed).filter(([key, value]) => {
            const cleanKey = String(key || '').trim();
            if (!cleanKey) return false;
            if (!value) return false;
            const cleanValue = String(value).trim();
            if (!cleanValue) return false;
            return cleanValue.toLowerCase() !== 'none';
        })
    );
}

export function normalizeProxyHeaders(headers: Record<string, string>): Record<string, string> {
    const next = { ...headers };
    const refererKey = Object.keys(next).find((key) => key.toLowerCase() === 'referer');
    const originKey = Object.keys(next).find((key) => key.toLowerCase() === 'origin');
    const referer = refererKey ? next[refererKey] : '';

    if (referer && !originKey) {
        try {
            next.Origin = new URL(referer).origin;
        } catch {
            // Ignore malformed referer header.
        }
    }

    return next;
}

export function issuePlaybackToken(payload: PlaybackTokenPayload, ttlMs = TOKEN_TTL_MS): string {
    const now = Date.now();
    pruneExpiredTokens(now);

    const token = crypto.randomUUID();
    playbackTokenStore.set(token, {
        ...payload,
        expiresAt: now + Math.max(30_000, ttlMs),
    });
    return token;
}

export function getPlaybackToken(token: string): PlaybackTokenPayload | null {
    const payload = playbackTokenStore.get(token);
    if (!payload) return null;

    if (payload.expiresAt <= Date.now()) {
        playbackTokenStore.delete(token);
        return null;
    }

    const { expiresAt, ...safePayload } = payload;
    void expiresAt;
    return safePayload;
}

function hexToBase64Url(hex: string): string {
    const normalized = hex.replace(/[^0-9a-f]/gi, '');
    return Buffer.from(normalized, 'hex')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

function toBase64Url(value: string): string {
    return value
        .trim()
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

function normalizeClearKeyJsonPayload(input: unknown): string | null {
    if (!input || typeof input !== 'object') return null;
    const obj = input as { keys?: unknown; type?: unknown };
    if (!Array.isArray(obj.keys)) return null;

    const keys = obj.keys
        .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const raw = item as { k?: unknown; kid?: unknown; kty?: unknown };
            const k = toBase64Url(String(raw.k ?? ''));
            const kid = toBase64Url(String(raw.kid ?? ''));
            if (!k || !kid) return null;

            return {
                kty: String(raw.kty ?? 'oct') || 'oct',
                k,
                kid,
            };
        })
        .filter((item): item is { kty: string; k: string; kid: string } => item !== null);

    if (keys.length === 0) return null;

    return JSON.stringify({
        keys,
        type: String(obj.type ?? 'temporary') || 'temporary',
    });
}

export function buildClearKeyLicenseJson(rawPayload: string): string | null {
    const raw = rawPayload.trim();
    if (!raw) return null;

    if (raw.startsWith('{')) {
        try {
            const parsed = JSON.parse(raw);
            return normalizeClearKeyJsonPayload(parsed);
        } catch {
            return null;
        }
    }

    try {
        const decoded = Buffer.from(raw, 'base64').toString('utf-8');
        const parsed = JSON.parse(decoded);
        return normalizeClearKeyJsonPayload(parsed);
    } catch {
        // Fallback to "kid:key" hex format.
    }

    if (raw.includes(':')) {
        const [kidHex, keyHex] = raw.split(':', 2).map((item) => item.trim());
        if (!kidHex || !keyHex) return null;

        const primaryKid = hexToBase64Url(kidHex);
        const primaryKey = hexToBase64Url(keyHex);
        const reverseKid = hexToBase64Url(keyHex);
        const reverseKey = hexToBase64Url(kidHex);

        const keys: Array<{ kty: string; kid: string; k: string }> = [
            {
                kty: 'oct',
                kid: primaryKid,
                k: primaryKey,
            },
        ];
        // Some providers send "key:kid" instead of "kid:key".
        // Include the reversed candidate as a fallback so the client can match either KID.
        if (
            reverseKid &&
            reverseKey &&
            (reverseKid !== primaryKid || reverseKey !== primaryKey)
        ) {
            keys.push({
                kty: 'oct',
                kid: reverseKid,
                k: reverseKey,
            });
        }

        const payload = {
            keys,
            type: 'temporary',
        };
        return JSON.stringify(payload);
    }

    return null;
}
