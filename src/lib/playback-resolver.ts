import { Channel } from '@/types/channel';
import {
    issuePlaybackToken,
    normalizeProxyHeaders,
    parseHeaderBlob,
} from '@/lib/playback-security';

export type ResolvedPlayback = {
    streamUrl: string;
    shouldProxy: boolean;
    proxyToken: string | null;
    drm: {
        type: 'none' | 'widevine' | 'clearkey';
        licenseProxyUrl: string | null;
    };
};

type ResolvePlaybackOptions = {
    proxyPath?: string;
    licensePath?: string;
};

// Proxy token is reused by DASH/HLS segment requests during an active session.
// Keep it longer than the default playback token TTL so streams don't fail mid-playback.
const PROXY_TOKEN_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

const DEFAULT_FORCE_PROXY_DOMAINS = [
    'cloudfront.net',
];

function getForceProxyDomains(): string[] {
    const raw = String(process.env.FORCE_PROXY_DOMAINS || '').trim();
    if (!raw) return DEFAULT_FORCE_PROXY_DOMAINS;

    const parsed = raw
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);

    return parsed.length > 0 ? parsed : DEFAULT_FORCE_PROXY_DOMAINS;
}

function shouldForceProxyForUrl(rawUrl: string): boolean {
    const value = String(rawUrl || '').trim();
    if (!value || !/^https?:\/\//i.test(value)) return false;

    try {
        const hostname = new URL(value).hostname.toLowerCase();
        const domains = getForceProxyDomains();
        return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
    } catch {
        return false;
    }
}

function looksLikeHexClearKeyPair(value: string): boolean {
    const raw = value.trim();
    return /^[0-9a-f]{32}:[0-9a-f]{32}$/i.test(raw);
}

function looksLikeClearKeyJsonPayload(value: string): boolean {
    const raw = value.trim();
    if (!raw) return false;

    const parseJson = (input: string): unknown => {
        try {
            return JSON.parse(input);
        } catch {
            return null;
        }
    };

    const direct = parseJson(raw);
    if (direct && typeof direct === 'object') {
        const obj = direct as { keys?: unknown };
        if (Array.isArray(obj.keys)) return true;
    }

    try {
        const decoded = Buffer.from(raw, 'base64').toString('utf-8');
        const parsed = parseJson(decoded);
        if (parsed && typeof parsed === 'object') {
            const obj = parsed as { keys?: unknown };
            return Array.isArray(obj.keys);
        }
    } catch {
        // ignore
    }

    return false;
}

function inferDrmType(channel: Pick<Channel, 'jenis' | 'url_license' | 'header_license'>): 'none' | 'widevine' | 'clearkey' {
    const streamType = String(channel.jenis || '').toLowerCase();
    const license = String(channel.url_license || '').trim();
    const headerLicense = String(channel.header_license || '').toLowerCase();

    if (streamType.includes('widevine')) return 'widevine';
    if (streamType.includes('clearkey')) return 'clearkey';
    if (headerLicense.includes('widevine')) return 'widevine';

    if (license) {
        if (looksLikeHexClearKeyPair(license) || looksLikeClearKeyJsonPayload(license)) {
            return 'clearkey';
        }
        if (/^https?:\/\//i.test(license)) {
            return 'widevine';
        }
    }

    return 'none';
}

export function resolvePlayback(channel: Channel, options: ResolvePlaybackOptions = {}): ResolvedPlayback {
    const proxyPath = options.proxyPath ?? '/api/proxy';
    const licensePath = options.licensePath ?? '/api/v1/playback/license';

    const proxyHeaders = normalizeProxyHeaders(parseHeaderBlob(channel.header_iptv || ''));
    const forceProxyByHost = shouldForceProxyForUrl(channel.hls || '');
    const useProxy = Boolean(channel.hls?.startsWith('http')) && (
        Object.keys(proxyHeaders).length > 0 || forceProxyByHost
    );

    let proxyToken: string | null = null;
    let streamUrl = channel.hls;

    if (useProxy) {
        proxyToken = issuePlaybackToken({
            kind: 'proxy',
            proxyHeaders,
        }, PROXY_TOKEN_TTL_MS);
        streamUrl = `${proxyPath}?url=${encodeURIComponent(channel.hls)}&token=${encodeURIComponent(proxyToken)}`;
    }

    const inferredDrmType = inferDrmType(channel);
    let drm: ResolvedPlayback['drm'] = {
        type: 'none',
        licenseProxyUrl: null,
    };

    if (inferredDrmType === 'widevine' && channel.url_license) {
        const licenseHeaders = normalizeProxyHeaders(parseHeaderBlob(channel.header_license || ''));
        const token = issuePlaybackToken({
            kind: 'widevine-license',
            licenseUrl: channel.url_license,
            licenseHeaders,
        });
        drm = {
            type: 'widevine',
            licenseProxyUrl: `${licensePath}?token=${encodeURIComponent(token)}`,
        };
    } else if (inferredDrmType === 'clearkey' && channel.url_license) {
        const token = issuePlaybackToken({
            kind: 'clearkey-license',
            clearKeyPayload: channel.url_license,
        });
        drm = {
            type: 'clearkey',
            licenseProxyUrl: `${licensePath}?token=${encodeURIComponent(token)}`,
        };
    }

    return {
        streamUrl,
        shouldProxy: useProxy,
        proxyToken,
        drm,
    };
}
