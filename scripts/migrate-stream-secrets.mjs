import fs from 'fs';
import path from 'path';

const root = process.cwd();

const channelsFile = path.join(root, 'src', 'data', 'channels.json');
const movieFile = path.join(root, 'src', 'data', 'movie.json');
const liveEventsFile = path.join(root, 'src', 'data', 'live-events.json');
const secretFile = path.join(root, 'data', 'private', 'stream-secrets.json');

function readJson(filePath, fallback) {
    try {
        const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').trim();
        if (!raw) return fallback;
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}

function writeJson(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function normalizeSecret(value) {
    if (typeof value !== 'string') return '';
    return value;
}

function collectEntrySecrets(entry) {
    return {
        hls: normalizeSecret(entry?.hls),
        url_license: normalizeSecret(entry?.url_license),
        header_iptv: normalizeSecret(entry?.header_iptv),
        header_license: normalizeSecret(entry?.header_license),
        updated_at: new Date().toISOString(),
    };
}

function hasSecret(entry) {
    return Boolean(
        (entry.hls && entry.hls.trim()) ||
        (entry.url_license && entry.url_license.trim()) ||
        (entry.header_iptv && entry.header_iptv.trim()) ||
        (entry.header_license && entry.header_license.trim())
    );
}

function scrubEntry(entry) {
    return {
        ...entry,
        hls: '',
        url_license: '',
        header_iptv: '',
        header_license: '',
    };
}

const existingSecret = readJson(secretFile, {
    version: 1,
    channels: {},
    movies: {},
    liveEvents: {},
});

const channels = readJson(channelsFile, []);
const moviesFile = readJson(movieFile, { country_name: 'Movies', country: 'MI', info: [] });
const liveEvents = readJson(liveEventsFile, []);

const nextSecret = {
    version: 1,
    channels: { ...(existingSecret.channels || {}) },
    movies: { ...(existingSecret.movies || {}) },
    liveEvents: { ...(existingSecret.liveEvents || {}) },
};

const scrubbedChannels = Array.isArray(channels)
    ? channels.map((item) => {
        const id = String(item?.id ?? '').trim();
        if (id) {
            const secret = collectEntrySecrets(item);
            if (hasSecret(secret)) nextSecret.channels[id] = secret;
        }
        return scrubEntry(item);
    })
    : [];

const movieInfo = Array.isArray(moviesFile?.info) ? moviesFile.info : [];
const scrubbedMovieInfo = movieInfo.map((item) => {
    const id = String(item?.id ?? '').trim();
    if (id) {
        const secret = collectEntrySecrets(item);
        if (hasSecret(secret)) nextSecret.movies[id] = secret;
    }
    return scrubEntry(item);
});

const scrubbedLiveEvents = Array.isArray(liveEvents)
    ? liveEvents.map((item) => {
        const id = String(item?.id ?? '').trim();
        if (id) {
            const secret = collectEntrySecrets(item);
            if (hasSecret(secret)) nextSecret.liveEvents[id] = secret;
        }
        return scrubEntry(item);
    })
    : [];

writeJson(secretFile, nextSecret);
writeJson(channelsFile, scrubbedChannels);
writeJson(movieFile, { ...moviesFile, info: scrubbedMovieInfo });
writeJson(liveEventsFile, scrubbedLiveEvents);

console.log('Migrated stream secrets to:', secretFile);
console.log('Scrubbed public data files.');
