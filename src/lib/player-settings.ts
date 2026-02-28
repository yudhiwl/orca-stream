import fs from 'fs';
import path from 'path';

export type PlayerSettings = {
    playbackEnabled: boolean;
    playbackEnabledWeb: boolean;
    playbackEnabledMobile: boolean;
    prerollEnabled: boolean;
    prerollMode: 'test' | 'production';
    prerollDurationSeconds: number;
    prerollMediaUrl: string;
    prerollClickUrl: string;
    rightSidebarAdEnabled: boolean;
    rightSidebarAdType: 'image' | 'iframe' | 'script';
    rightSidebarAdImageUrl: string;
    rightSidebarAdIframeUrl: string;
    rightSidebarAdScript: string;
    rightSidebarAdClickUrl: string;
    rightSidebarAdAltText: string;
    topPlayerAdEnabled: boolean;
    topPlayerAdType: 'image' | 'iframe' | 'script';
    topPlayerAdImageUrl: string;
    topPlayerAdIframeUrl: string;
    topPlayerAdScript: string;
    topPlayerAdClickUrl: string;
    topPlayerAdAltText: string;
    topPlayerMobileFallbackEnabled: boolean;
    topPlayerMobileFallbackType: 'image' | 'iframe' | 'script';
    topPlayerMobileFallbackImageUrl: string;
    topPlayerMobileFallbackIframeUrl: string;
    topPlayerMobileFallbackScript: string;
    topPlayerMobileFallbackClickUrl: string;
    topPlayerMobileFallbackAltText: string;
    updatedAt: string;
};

const SETTINGS_FILE = path.join(process.cwd(), 'data', 'private', 'player-settings.json');
const SETTINGS_JSON_ENV_KEY = 'ORCASTREAM_PLAYER_SETTINGS_JSON';
const SETTINGS_B64_ENV_KEY = 'ORCASTREAM_PLAYER_SETTINGS_B64';
const DEFAULT_PREROLL_DURATION_SECONDS = 5;
const DEFAULT_PREROLL_MODE: PlayerSettings['prerollMode'] = 'test';

function normalizePrerollDuration(value: unknown): number {
    const num = Number(value);
    if (!Number.isFinite(num)) return DEFAULT_PREROLL_DURATION_SECONDS;
    const rounded = Math.round(num);
    if (rounded < 1) return 1;
    if (rounded > 30) return 30;
    return rounded;
}

function normalizePrerollMode(value: unknown): PlayerSettings['prerollMode'] {
    return value === 'production' ? 'production' : DEFAULT_PREROLL_MODE;
}

function defaultSettings(): PlayerSettings {
    return {
        playbackEnabled: true,
        playbackEnabledWeb: true,
        playbackEnabledMobile: true,
        prerollEnabled: false,
        prerollMode: DEFAULT_PREROLL_MODE,
        prerollDurationSeconds: DEFAULT_PREROLL_DURATION_SECONDS,
        prerollMediaUrl: '',
        prerollClickUrl: '',
        rightSidebarAdEnabled: false,
        rightSidebarAdType: 'image',
        rightSidebarAdImageUrl: '',
        rightSidebarAdIframeUrl: '',
        rightSidebarAdScript: '',
        rightSidebarAdClickUrl: '',
        rightSidebarAdAltText: 'Sponsored',
        topPlayerAdEnabled: false,
        topPlayerAdType: 'image',
        topPlayerAdImageUrl: '',
        topPlayerAdIframeUrl: '',
        topPlayerAdScript: '',
        topPlayerAdClickUrl: '',
        topPlayerAdAltText: 'Sponsored',
        topPlayerMobileFallbackEnabled: false,
        topPlayerMobileFallbackType: 'image',
        topPlayerMobileFallbackImageUrl: '',
        topPlayerMobileFallbackIframeUrl: '',
        topPlayerMobileFallbackScript: '',
        topPlayerMobileFallbackClickUrl: '',
        topPlayerMobileFallbackAltText: 'Sponsored',
        updatedAt: '',
    };
}

function normalizeSettings(parsed: Partial<PlayerSettings>): PlayerSettings {
    const legacyPlaybackEnabled = parsed.playbackEnabled !== false;
    const playbackEnabledWeb =
        typeof parsed.playbackEnabledWeb === 'boolean'
            ? parsed.playbackEnabledWeb
            : legacyPlaybackEnabled;
    const playbackEnabledMobile =
        typeof parsed.playbackEnabledMobile === 'boolean'
            ? parsed.playbackEnabledMobile
            : legacyPlaybackEnabled;

    return {
        playbackEnabled: playbackEnabledWeb,
        playbackEnabledWeb,
        playbackEnabledMobile,
        prerollEnabled: parsed.prerollEnabled === true,
        prerollMode: normalizePrerollMode(parsed.prerollMode),
        prerollDurationSeconds: normalizePrerollDuration(parsed.prerollDurationSeconds),
        prerollMediaUrl: String(parsed.prerollMediaUrl ?? '').trim(),
        prerollClickUrl: String(parsed.prerollClickUrl ?? '').trim(),
        rightSidebarAdEnabled: parsed.rightSidebarAdEnabled === true,
        rightSidebarAdType:
            parsed.rightSidebarAdType === 'iframe' || parsed.rightSidebarAdType === 'script'
                ? parsed.rightSidebarAdType
                : 'image',
        rightSidebarAdImageUrl: String(parsed.rightSidebarAdImageUrl ?? '').trim(),
        rightSidebarAdIframeUrl: String(parsed.rightSidebarAdIframeUrl ?? '').trim(),
        rightSidebarAdScript: typeof parsed.rightSidebarAdScript === 'string' ? parsed.rightSidebarAdScript : '',
        rightSidebarAdClickUrl: String(parsed.rightSidebarAdClickUrl ?? '').trim(),
        rightSidebarAdAltText: String(parsed.rightSidebarAdAltText ?? 'Sponsored').trim() || 'Sponsored',
        topPlayerAdEnabled: parsed.topPlayerAdEnabled === true,
        topPlayerAdType:
            parsed.topPlayerAdType === 'iframe' || parsed.topPlayerAdType === 'script'
                ? parsed.topPlayerAdType
                : 'image',
        topPlayerAdImageUrl: String(parsed.topPlayerAdImageUrl ?? '').trim(),
        topPlayerAdIframeUrl: String(parsed.topPlayerAdIframeUrl ?? '').trim(),
        topPlayerAdScript: typeof parsed.topPlayerAdScript === 'string' ? parsed.topPlayerAdScript : '',
        topPlayerAdClickUrl: String(parsed.topPlayerAdClickUrl ?? '').trim(),
        topPlayerAdAltText: String(parsed.topPlayerAdAltText ?? 'Sponsored').trim() || 'Sponsored',
        topPlayerMobileFallbackEnabled: parsed.topPlayerMobileFallbackEnabled === true,
        topPlayerMobileFallbackType:
            parsed.topPlayerMobileFallbackType === 'iframe' || parsed.topPlayerMobileFallbackType === 'script'
                ? parsed.topPlayerMobileFallbackType
                : 'image',
        topPlayerMobileFallbackImageUrl: String(parsed.topPlayerMobileFallbackImageUrl ?? '').trim(),
        topPlayerMobileFallbackIframeUrl: String(parsed.topPlayerMobileFallbackIframeUrl ?? '').trim(),
        topPlayerMobileFallbackScript:
            typeof parsed.topPlayerMobileFallbackScript === 'string'
                ? parsed.topPlayerMobileFallbackScript
                : '',
        topPlayerMobileFallbackClickUrl: String(parsed.topPlayerMobileFallbackClickUrl ?? '').trim(),
        topPlayerMobileFallbackAltText:
            String(parsed.topPlayerMobileFallbackAltText ?? 'Sponsored').trim() || 'Sponsored',
        updatedAt: String(parsed.updatedAt ?? ''),
    };
}

function parseSettingsFromRaw(raw: string): PlayerSettings | null {
    const normalizedRaw = raw.replace(/^\uFEFF/, '').trim();
    if (!normalizedRaw) return null;

    try {
        const parsed = JSON.parse(normalizedRaw) as Partial<PlayerSettings>;
        return normalizeSettings(parsed);
    } catch {
        return null;
    }
}

function readSettingsFromEnv(): PlayerSettings | null {
    const rawJson = String(process.env[SETTINGS_JSON_ENV_KEY] ?? '').trim();
    if (rawJson) {
        const fromJson = parseSettingsFromRaw(rawJson);
        if (fromJson) return fromJson;
    }

    const rawB64 = String(process.env[SETTINGS_B64_ENV_KEY] ?? '').trim();
    if (rawB64) {
        try {
            const decoded = Buffer.from(rawB64, 'base64').toString('utf-8');
            const fromB64 = parseSettingsFromRaw(decoded);
            if (fromB64) return fromB64;
        } catch {
            // ignore invalid base64 payload
        }
    }

    return null;
}

function ensureSettingsDir() {
    fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
}

export function readPlayerSettings(): PlayerSettings {
    try {
        const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
        const fromFile = parseSettingsFromRaw(raw);
        if (fromFile) return fromFile;
    } catch {
        // fallback below
    }

    return readSettingsFromEnv() ?? defaultSettings();
}

export function writePlayerSettings(patch: Partial<PlayerSettings>): PlayerSettings {
    const current = readPlayerSettings();
    const nextPlaybackEnabledWeb =
        typeof patch.playbackEnabledWeb === 'boolean'
            ? patch.playbackEnabledWeb
            : (
                typeof patch.playbackEnabled === 'boolean'
                    ? patch.playbackEnabled
                    : current.playbackEnabledWeb
            );
    const nextPlaybackEnabledMobile =
        typeof patch.playbackEnabledMobile === 'boolean'
            ? patch.playbackEnabledMobile
            : (
                typeof patch.playbackEnabled === 'boolean'
                    ? patch.playbackEnabled
                    : current.playbackEnabledMobile
            );

    const next: PlayerSettings = {
        playbackEnabled: nextPlaybackEnabledWeb,
        playbackEnabledWeb: nextPlaybackEnabledWeb,
        playbackEnabledMobile: nextPlaybackEnabledMobile,
        prerollEnabled:
            typeof patch.prerollEnabled === 'boolean'
                ? patch.prerollEnabled
                : current.prerollEnabled,
        prerollMode: normalizePrerollMode(patch.prerollMode ?? current.prerollMode),
        prerollDurationSeconds: normalizePrerollDuration(
            patch.prerollDurationSeconds ?? current.prerollDurationSeconds
        ),
        prerollMediaUrl:
            typeof patch.prerollMediaUrl === 'string'
                ? patch.prerollMediaUrl.trim()
                : current.prerollMediaUrl,
        prerollClickUrl:
            typeof patch.prerollClickUrl === 'string'
                ? patch.prerollClickUrl.trim()
                : current.prerollClickUrl,
        rightSidebarAdEnabled:
            typeof patch.rightSidebarAdEnabled === 'boolean'
                ? patch.rightSidebarAdEnabled
                : current.rightSidebarAdEnabled,
        rightSidebarAdType:
            patch.rightSidebarAdType === 'iframe' || patch.rightSidebarAdType === 'script'
                ? patch.rightSidebarAdType
                : (patch.rightSidebarAdType === 'image' ? 'image' : current.rightSidebarAdType),
        rightSidebarAdImageUrl:
            typeof patch.rightSidebarAdImageUrl === 'string'
                ? patch.rightSidebarAdImageUrl.trim()
                : current.rightSidebarAdImageUrl,
        rightSidebarAdIframeUrl:
            typeof patch.rightSidebarAdIframeUrl === 'string'
                ? patch.rightSidebarAdIframeUrl.trim()
                : current.rightSidebarAdIframeUrl,
        rightSidebarAdScript:
            typeof patch.rightSidebarAdScript === 'string'
                ? patch.rightSidebarAdScript
                : current.rightSidebarAdScript,
        rightSidebarAdClickUrl:
            typeof patch.rightSidebarAdClickUrl === 'string'
                ? patch.rightSidebarAdClickUrl.trim()
                : current.rightSidebarAdClickUrl,
        rightSidebarAdAltText:
            typeof patch.rightSidebarAdAltText === 'string'
                ? (patch.rightSidebarAdAltText.trim() || 'Sponsored')
                : current.rightSidebarAdAltText,
        topPlayerAdEnabled:
            typeof patch.topPlayerAdEnabled === 'boolean'
                ? patch.topPlayerAdEnabled
                : current.topPlayerAdEnabled,
        topPlayerAdType:
            patch.topPlayerAdType === 'iframe' || patch.topPlayerAdType === 'script'
                ? patch.topPlayerAdType
                : (patch.topPlayerAdType === 'image' ? 'image' : current.topPlayerAdType),
        topPlayerAdImageUrl:
            typeof patch.topPlayerAdImageUrl === 'string'
                ? patch.topPlayerAdImageUrl.trim()
                : current.topPlayerAdImageUrl,
        topPlayerAdIframeUrl:
            typeof patch.topPlayerAdIframeUrl === 'string'
                ? patch.topPlayerAdIframeUrl.trim()
                : current.topPlayerAdIframeUrl,
        topPlayerAdScript:
            typeof patch.topPlayerAdScript === 'string'
                ? patch.topPlayerAdScript
                : current.topPlayerAdScript,
        topPlayerAdClickUrl:
            typeof patch.topPlayerAdClickUrl === 'string'
                ? patch.topPlayerAdClickUrl.trim()
                : current.topPlayerAdClickUrl,
        topPlayerAdAltText:
            typeof patch.topPlayerAdAltText === 'string'
                ? (patch.topPlayerAdAltText.trim() || 'Sponsored')
                : current.topPlayerAdAltText,
        topPlayerMobileFallbackEnabled:
            typeof patch.topPlayerMobileFallbackEnabled === 'boolean'
                ? patch.topPlayerMobileFallbackEnabled
                : current.topPlayerMobileFallbackEnabled,
        topPlayerMobileFallbackType:
            patch.topPlayerMobileFallbackType === 'iframe' || patch.topPlayerMobileFallbackType === 'script'
                ? patch.topPlayerMobileFallbackType
                : (
                    patch.topPlayerMobileFallbackType === 'image'
                        ? 'image'
                        : current.topPlayerMobileFallbackType
                ),
        topPlayerMobileFallbackImageUrl:
            typeof patch.topPlayerMobileFallbackImageUrl === 'string'
                ? patch.topPlayerMobileFallbackImageUrl.trim()
                : current.topPlayerMobileFallbackImageUrl,
        topPlayerMobileFallbackIframeUrl:
            typeof patch.topPlayerMobileFallbackIframeUrl === 'string'
                ? patch.topPlayerMobileFallbackIframeUrl.trim()
                : current.topPlayerMobileFallbackIframeUrl,
        topPlayerMobileFallbackScript:
            typeof patch.topPlayerMobileFallbackScript === 'string'
                ? patch.topPlayerMobileFallbackScript
                : current.topPlayerMobileFallbackScript,
        topPlayerMobileFallbackClickUrl:
            typeof patch.topPlayerMobileFallbackClickUrl === 'string'
                ? patch.topPlayerMobileFallbackClickUrl.trim()
                : current.topPlayerMobileFallbackClickUrl,
        topPlayerMobileFallbackAltText:
            typeof patch.topPlayerMobileFallbackAltText === 'string'
                ? (patch.topPlayerMobileFallbackAltText.trim() || 'Sponsored')
                : current.topPlayerMobileFallbackAltText,
        updatedAt: new Date().toISOString(),
    };

    ensureSettingsDir();
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2), 'utf-8');
    return next;
}

export function isPlaybackEnabled(): boolean {
    return readPlayerSettings().playbackEnabledWeb;
}

export function isWebPlaybackEnabled(): boolean {
    return readPlayerSettings().playbackEnabledWeb;
}

export function isMobilePlaybackEnabled(): boolean {
    return readPlayerSettings().playbackEnabledMobile;
}
