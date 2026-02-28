import { Channel } from '@/types/channel';
import { LiveEvent } from '@/types/live-event';
import { toLiveEventWatchId } from '@/lib/live-event-id';
import { buildPublicLiveSportsFeed } from '@/lib/live-sports-feed';
import {
    readChannelsData,
    readLiveEventsData,
    readMovieChannelsData,
    sanitizeChannelsForClient,
    sanitizeLiveEventsForClient,
} from '@/lib/playback-security';

export type MobilePublicChannel = {
    id: string;
    name: string;
    tagline: string;
    image: string;
    country_name: string;
    alpha_2_code: string;
    is_live: 't' | 'f';
    premium: 't' | 'f';
    jenis: string;
    t_stamp?: string;
    s_stamp?: string;
};

export type MobileCountryItem = {
    code: string;
    name: string;
    country: string;
    country_name: string;
};

type CatalogEntry = {
    payload: MobilePublicChannel;
    category: string;
    countryCode: string;
    countryName: string;
    isMovie: boolean;
};

const CATEGORY_LABELS: Record<string, string> = {
    SP: 'Sports',
    KD: 'Kids',
    LO: 'TV Lokal',
    RI: 'TVRI',
    MI: 'Movies',
};

function clean(value: unknown): string {
    return String(value ?? '').trim();
}

function toTf(value: unknown): 't' | 'f' {
    return String(value ?? '').trim().toLowerCase() === 't' ? 't' : 'f';
}

function parseStamp(value?: string): number | null {
    if (!value) return null;
    const normalized = clean(value);
    if (!normalized || normalized.toLowerCase() === 'none') return null;

    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
}

function channelToMobilePublic(channel: Channel): MobilePublicChannel {
    return {
        id: clean(channel.id),
        name: clean(channel.name),
        tagline: clean(channel.tagline),
        image: clean(channel.image),
        country_name: clean(channel.country_name),
        alpha_2_code: clean(channel.alpha_2_code).toUpperCase(),
        is_live: toTf(channel.is_live),
        premium: toTf(channel.premium),
        jenis: clean(channel.jenis) || 'unknown',
        t_stamp: clean(channel.t_stamp),
        s_stamp: clean(channel.s_stamp),
    };
}

function liveEventToMobilePublic(event: LiveEvent): MobilePublicChannel {
    return {
        id: toLiveEventWatchId(clean(event.id)),
        name: clean(event.competition) || clean(event.title) || 'Live Event',
        tagline: clean(event.title),
        image: clean(event.thumbnail),
        country_name: 'Events',
        alpha_2_code: 'EV',
        is_live: toTf(event.is_live),
        premium: 'f',
        jenis: clean(event.jenis) || 'unknown',
        t_stamp: clean(event.t_stamp),
        s_stamp: clean(event.s_stamp),
    };
}

function dedupeChannels(channels: MobilePublicChannel[]): MobilePublicChannel[] {
    const seen = new Set<string>();
    const out: MobilePublicChannel[] = [];

    for (const channel of channels) {
        const id = clean(channel.id);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(channel);
    }

    return out;
}

function byNameThenId(a: MobilePublicChannel, b: MobilePublicChannel): number {
    const nameA = clean(a.name).toLowerCase();
    const nameB = clean(b.name).toLowerCase();
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;

    const idA = clean(a.id);
    const idB = clean(b.id);
    if (idA < idB) return -1;
    if (idA > idB) return 1;
    return 0;
}

function buildCatalogEntries(): CatalogEntry[] {
    const source = [
        ...sanitizeChannelsForClient(readChannelsData()),
        ...sanitizeChannelsForClient(readMovieChannelsData()),
    ];

    return source.map((channel) => {
        const payload = channelToMobilePublic(channel);
        const category = clean(channel.category).toLowerCase();
        const countryCode = payload.alpha_2_code;
        const countryName = clean(channel.country_name);
        const isMovie =
            toTf(channel.is_movie) === 't' ||
            countryCode === 'MI' ||
            countryName.toLowerCase().includes('movie');

        return {
            payload,
            category,
            countryCode,
            countryName,
            isMovie,
        };
    });
}

function buildEventChannels(): MobilePublicChannel[] {
    const source = sanitizeLiveEventsForClient(buildPublicLiveSportsFeed(readLiveEventsData()).events);
    const channels = source.map(liveEventToMobilePublic);
    return dedupeChannels(channels);
}

function isCategoryCode(code: string): boolean {
    return Object.prototype.hasOwnProperty.call(CATEGORY_LABELS, code);
}

function matchCategory(entry: CatalogEntry, code: string): boolean {
    if (entry.countryCode === code) return true;

    switch (code) {
        case 'SP':
            return entry.category.includes('sport');
        case 'KD':
            return entry.category.includes('kid');
        case 'LO':
            return entry.category.includes('local');
        case 'RI':
            return entry.category.includes('relig') || entry.countryName.toLowerCase().includes('tvri');
        case 'MI':
            return entry.isMovie;
        default:
            return false;
    }
}

function streamFamily(jenis: string): 'dash' | 'hls' | 'other' {
    const lower = clean(jenis).toLowerCase();
    if (lower.includes('dash') || lower.includes('mpd')) return 'dash';
    if (lower.includes('hls') || lower.includes('m3u8')) return 'hls';
    return 'other';
}

export function listMobileCatalogChannels(): MobilePublicChannel[] {
    const channels = buildCatalogEntries().map((entry) => entry.payload);
    return dedupeChannels(channels).sort(byNameThenId);
}

export function listMobileEvents(): MobilePublicChannel[] {
    return buildEventChannels();
}

export function listMobileAllChannels(): MobilePublicChannel[] {
    return dedupeChannels([
        ...listMobileCatalogChannels(),
        ...listMobileEvents(),
    ]);
}

export function listMobileCountries(): MobileCountryItem[] {
    const map = new Map<string, string>();
    for (const entry of buildCatalogEntries()) {
        const code = clean(entry.countryCode).toUpperCase();
        if (!code) continue;

        const name = clean(entry.countryName) || CATEGORY_LABELS[code] || code;
        if (!map.has(code)) {
            map.set(code, name);
        }
    }

    for (const [code, name] of Object.entries(CATEGORY_LABELS)) {
        if (!map.has(code)) {
            map.set(code, name);
        }
    }

    return Array.from(map.entries())
        .map(([code, name]) => ({
            code,
            name,
            country: code,
            country_name: name,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'id-ID'));
}

export function filterMobileChannelsByCode(code: string): {
    code: string;
    name: string;
    channels: MobilePublicChannel[];
} {
    const normalizedCode = clean(code).toUpperCase();
    const entries = buildCatalogEntries();

    const filtered = isCategoryCode(normalizedCode)
        ? entries.filter((entry) => matchCategory(entry, normalizedCode))
        : entries.filter((entry) => entry.countryCode === normalizedCode);

    const countries = listMobileCountries();
    const name = countries.find((item) => item.code === normalizedCode)?.name || normalizedCode;

    return {
        code: normalizedCode,
        name,
        channels: dedupeChannels(filtered.map((entry) => entry.payload)).sort(byNameThenId),
    };
}

export function buildMobileHomeSections(): {
    featured: MobilePublicChannel[];
    liveNow: MobilePublicChannel[];
    upcoming: MobilePublicChannel[];
} {
    const catalog = listMobileCatalogChannels();
    const events = listMobileEvents();

    const featured = [...catalog]
        .sort((left, right) => {
            if (left.premium !== right.premium) {
                return left.premium === 't' ? -1 : 1;
            }
            return byNameThenId(left, right);
        })
        .slice(0, 18);

    const liveNow = dedupeChannels([
        ...catalog.filter((item) => item.is_live === 't'),
        ...events.filter((item) => item.is_live === 't'),
    ]).sort(byNameThenId);

    const upcoming = events
        .filter((item) => item.is_live !== 't')
        .sort((left, right) => {
            const leftStamp = parseStamp(left.t_stamp) ?? parseStamp(left.s_stamp) ?? Number.MAX_SAFE_INTEGER;
            const rightStamp = parseStamp(right.t_stamp) ?? parseStamp(right.s_stamp) ?? Number.MAX_SAFE_INTEGER;
            if (leftStamp !== rightStamp) return leftStamp - rightStamp;
            return byNameThenId(left, right);
        })
        .slice(0, 24);

    return { featured, liveNow, upcoming };
}

export function buildMobileRelatedChannels(channelId: string, limit = 12): MobilePublicChannel[] {
    const allChannels = listMobileAllChannels();
    const normalizedLimit = Math.min(Math.max(Math.trunc(limit) || 12, 1), 30);
    const normalizedId = clean(channelId);
    const liveEventId = toLiveEventWatchId(normalizedId);

    const target =
        allChannels.find((item) => item.id === normalizedId) ||
        allChannels.find((item) => item.id === liveEventId);

    if (!target) {
        return allChannels.slice(0, normalizedLimit);
    }

    const targetFamily = streamFamily(target.jenis);

    return allChannels
        .filter((item) => item.id !== target.id)
        .map((item) => {
            let score = 0;
            if (clean(item.alpha_2_code) && item.alpha_2_code === target.alpha_2_code) score += 3;
            if (item.is_live === target.is_live) score += 1;
            if (streamFamily(item.jenis) === targetFamily) score += 1;
            return { score, item };
        })
        .sort((left, right) => {
            if (left.score !== right.score) return right.score - left.score;
            return byNameThenId(left.item, right.item);
        })
        .slice(0, normalizedLimit)
        .map((entry) => entry.item);
}
