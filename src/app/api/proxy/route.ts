import { lookup } from 'dns/promises';
import net from 'net';
import { NextRequest, NextResponse } from 'next/server';
import { getPlaybackToken } from '@/lib/playback-security';
import { isMobilePlaybackEnabled, isWebPlaybackEnabled } from '@/lib/player-settings';

const ALLOW_METHODS = 'GET, HEAD, POST, OPTIONS';
const FETCH_TIMEOUT_MS = 30000;
const HOST_LOOKUP_CACHE_TTL_MS = 5 * 60 * 1000;
const BLOCKED_HOSTNAMES = new Set([
    'localhost',
    'metadata.google.internal',
    'metadata',
    'kubernetes.default.svc',
    'kubernetes.default',
]);
const blockedHostnameSuffixes = ['.localhost', '.local', '.internal', '.localdomain', '.home.arpa'];
const hostSafetyCache = new Map<string, { safe: boolean; expiresAt: number }>();
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';
export const preferredRegion = ['iad1', 'sfo1'];

function buildBaseUrl(sourceUrl: string): string {
    return sourceUrl.substring(0, sourceUrl.lastIndexOf('/') + 1);
}

function isAbsoluteOrSpecialUri(uri: string): boolean {
    return /^(https?:)?\/\//i.test(uri) || uri.startsWith('data:') || uri.startsWith('blob:');
}

function toAbsoluteUri(uri: string, baseUrl: string): string {
    try {
        return new URL(uri, baseUrl).toString();
    } catch {
        return uri;
    }
}

function rewriteTagUriAttributes(line: string, baseUrl: string): string {
    return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => {
        if (isAbsoluteOrSpecialUri(uri)) return `URI="${uri}"`;
        return `URI="${toAbsoluteUri(uri, baseUrl)}"`;
    });
}

function isLikelyMpdXml(payload: string): boolean {
    if (!payload) return false;
    const trimmed = payload.trimStart();
    if (!trimmed) return false;
    return /^<\?xml/i.test(trimmed) || /^<MPD[\s>]/i.test(trimmed);
}

function rewriteHlsManifest(manifest: string, sourceUrl: string): string {
    const baseUrl = buildBaseUrl(sourceUrl);

    return manifest
        .split(/\r?\n/)
        .map((line) => {
            const trimmed = line.trim();
            if (!trimmed) return line;

            if (
                trimmed.startsWith('#EXT-X-KEY') ||
                trimmed.startsWith('#EXT-X-MAP') ||
                trimmed.startsWith('#EXT-X-MEDIA') ||
                trimmed.startsWith('#EXT-X-I-FRAME-STREAM-INF') ||
                trimmed.startsWith('#EXT-X-SESSION-KEY')
            ) {
                return rewriteTagUriAttributes(line, baseUrl);
            }

            if (trimmed.startsWith('#')) return line;
            if (isAbsoluteOrSpecialUri(trimmed)) return line;

            return toAbsoluteUri(trimmed, baseUrl);
        })
        .join('\n');
}

function normalizeHostname(input: string): string {
    return input.trim().toLowerCase().replace(/\.$/, '');
}

function isPrivateIpv4Address(input: string): boolean {
    const parts = input.split('.').map((part) => Number(part));
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
        return true;
    }

    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
}

function isPrivateIpv6Address(input: string): boolean {
    const normalized = input.toLowerCase();
    if (normalized === '::1') return true;
    if (normalized.startsWith('fe80:')) return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    return false;
}

function isPrivateIpAddress(hostOrIp: string): boolean {
    const ipVersion = net.isIP(hostOrIp);
    if (ipVersion === 4) return isPrivateIpv4Address(hostOrIp);
    if (ipVersion === 6) return isPrivateIpv6Address(hostOrIp);
    return false;
}

function isBlockedHostname(hostname: string): boolean {
    if (BLOCKED_HOSTNAMES.has(hostname)) return true;
    return blockedHostnameSuffixes.some((suffix) => hostname.endsWith(suffix));
}

async function isSafePublicHostname(hostname: string): Promise<boolean> {
    const now = Date.now();
    const cached = hostSafetyCache.get(hostname);
    if (cached && cached.expiresAt > now) {
        return cached.safe;
    }

    if (isBlockedHostname(hostname)) {
        hostSafetyCache.set(hostname, { safe: false, expiresAt: now + HOST_LOOKUP_CACHE_TTL_MS });
        return false;
    }

    try {
        const addresses = await lookup(hostname, { all: true, verbatim: true });
        if (!Array.isArray(addresses) || addresses.length === 0) {
            hostSafetyCache.set(hostname, { safe: false, expiresAt: now + HOST_LOOKUP_CACHE_TTL_MS });
            return false;
        }

        const safe = addresses.every((item) => {
            const address = String(item?.address || '').trim();
            if (!address) return false;
            return !isPrivateIpAddress(address);
        });

        hostSafetyCache.set(hostname, { safe, expiresAt: now + HOST_LOOKUP_CACHE_TTL_MS });
        return safe;
    } catch {
        hostSafetyCache.set(hostname, { safe: false, expiresAt: now + HOST_LOOKUP_CACHE_TTL_MS });
        return false;
    }
}

async function validateProxyTargetUrl(rawUrl: string): Promise<
    { ok: true; url: string } |
    { ok: false; status: number; message: string }
> {
    const input = String(rawUrl || '').trim();
    if (!input) {
        return { ok: false, status: 400, message: 'Missing url param' };
    }

    let parsed: URL;
    try {
        parsed = new URL(input);
    } catch {
        return { ok: false, status: 400, message: 'Invalid url param' };
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { ok: false, status: 400, message: 'Only http/https URLs are allowed' };
    }

    const hostname = normalizeHostname(parsed.hostname);
    if (!hostname) {
        return { ok: false, status: 400, message: 'Invalid target hostname' };
    }

    const ipVersion = net.isIP(hostname);
    if (ipVersion) {
        if (isPrivateIpAddress(hostname)) {
            return { ok: false, status: 403, message: 'Blocked private target host' };
        }
        return { ok: true, url: parsed.toString() };
    }

    const isSafe = await isSafePublicHostname(hostname);
    if (!isSafe) {
        return { ok: false, status: 403, message: 'Blocked non-public target host' };
    }

    return { ok: true, url: parsed.toString() };
}

function normalizeContentType(resolvedUrl: string, contentType: string): string {
    const lowerType = contentType.toLowerCase();
    if (lowerType.includes('image/x-pict') || /\.pict(?:$|\?)/i.test(resolvedUrl)) {
        // Some HLS providers ship MPEG-TS chunks with .pict + image/x-pict headers.
        return 'video/mp2t';
    }
    return contentType;
}

/**
 * When the stream URL uses a raw IP (e.g. 140.150.x.x) but the upstream
 * virtual-host expects a domain (e.g. live1.pro2cdnlive.com), Node fetch()
 * sends the IP as Host header and the server rejects the connection -> 502.
 *
 * This helper detects an IP-based URL + a Host header in the custom headers,
 * rewrites the URL hostname to the Host value, and removes the Host entry
 * from headers so fetch() naturally sends the correct Host.
 */
function applyHostRewrite(
    url: string,
    headers: Record<string, string>
): { url: string; headers: Record<string, string> } {
    // Find a Host header (case-insensitive).
    const hostKey = Object.keys(headers).find((key) => key.toLowerCase() === 'host');
    if (!hostKey) return { url, headers };

    const cleaned = { ...headers };
    const virtualHost = String(cleaned[hostKey] || '').trim();
    delete cleaned[hostKey];
    if (!virtualHost) return { url, headers: cleaned };

    try {
        const parsed = new URL(url);
        // Only rewrite when the URL uses a raw IPv4 address.
        const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(parsed.hostname);
        if (!isIp) return { url: parsed.toString(), headers: cleaned };

        const [virtualHostName, virtualHostPort] = virtualHost.split(':', 2);
        if (!virtualHostName) return { url: parsed.toString(), headers: cleaned };

        parsed.hostname = virtualHostName;
        if (virtualHostPort && /^\d+$/.test(virtualHostPort)) {
            parsed.port = virtualHostPort;
        }

        return { url: parsed.toString(), headers: cleaned };
    } catch {
        return { url, headers: cleaned };
    }
}

function shouldRetryStatus(status: number): boolean {
    return status === 502 || status === 503 || status === 504;
}

function getFallbackUrls(sourceUrl: string): string[] {
    try {
        const parsed = new URL(sourceUrl);
        if (parsed.hostname !== 'cdn10jtedge.indihometv.com') {
            return [];
        }

        const fallback = new URL(sourceUrl);
        fallback.hostname = 'cdn09jtedge.indihometv.com';
        return [fallback.toString()];
    } catch {
        return [];
    }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = FETCH_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, {
            ...init,
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }
}

async function fetchWithFallback(url: string, init: RequestInit): Promise<{ upstream: Response; requestUrl: string }> {
    const candidates = [url, ...getFallbackUrls(url)];
    let lastError: unknown = null;

    for (let index = 0; index < candidates.length; index += 1) {
        const candidate = candidates[index];
        const hasNext = index < candidates.length - 1;

        try {
            const upstream = await fetchWithTimeout(candidate, init);
            if (hasNext && shouldRetryStatus(upstream.status)) {
                continue;
            }
            return { upstream, requestUrl: candidate };
        } catch (error) {
            lastError = error;
            if (!hasNext) throw error;
        }
    }

    throw lastError instanceof Error ? lastError : new Error('Upstream request failed');
}

function getProxyTarget(request: NextRequest): {
    url: string | null;
    safeHeaders: Record<string, string>;
    tokenValid: boolean;
} {
    const url = request.nextUrl.searchParams.get('url');
    const token = request.nextUrl.searchParams.get('token')?.trim();

    if (!token) {
        return { url, safeHeaders: {}, tokenValid: false };
    }

    const payload = getPlaybackToken(token);
    if (!payload || payload.kind !== 'proxy') {
        return { url, safeHeaders: {}, tokenValid: false };
    }

    return {
        url,
        safeHeaders: payload.proxyHeaders,
        tokenValid: true,
    };
}

function isBlockedForwardHeader(headerName: string): boolean {
    if (
        headerName === 'host' ||
        headerName === 'connection' ||
        headerName === 'content-length' ||
        headerName === 'accept-encoding' ||
        headerName === 'cookie' ||
        headerName === 'origin' ||
        headerName === 'referer' ||
        headerName === 'user-agent' ||
        headerName === 'priority' ||
        headerName === 'transfer-encoding'
    ) {
        return true;
    }
    return headerName.startsWith('sec-');
}

function buildPostForwardHeaders(
    request: NextRequest,
    safeHeaders: Record<string, string>
): Record<string, string> {
    const passthrough: Record<string, string> = {};
    const sanitizedCustomHeaders: Record<string, string> = {};

    for (const [key, value] of request.headers.entries()) {
        const lower = key.toLowerCase();
        if (isBlockedForwardHeader(lower)) continue;
        passthrough[key] = value;
    }

    for (const [key, value] of Object.entries(safeHeaders)) {
        const lower = key.toLowerCase();
        if (isBlockedForwardHeader(lower)) continue;
        sanitizedCustomHeaders[key] = value;
    }

    return {
        ...passthrough,
        ...sanitizedCustomHeaders,
        'Accept': '*/*',
        'Content-Type': request.headers.get('content-type') || 'application/octet-stream',
    };
}

function isPlaybackAllowedForRequest(request: NextRequest): boolean {
    if (request.nextUrl.pathname.startsWith('/api/mobile/')) {
        return isMobilePlaybackEnabled();
    }
    return isWebPlaybackEnabled();
}

export async function GET(request: NextRequest) {
    if (!isPlaybackAllowedForRequest(request)) {
        return new NextResponse('Maaf siaran tidak tersedia saat ini', { status: 503 });
    }

    const { url, safeHeaders, tokenValid } = getProxyTarget(request);

    if (!url) {
        return new NextResponse('Missing url param', { status: 400 });
    }
    if (!tokenValid) {
        return new NextResponse('Invalid or expired proxy token. Refresh playback to get a new token.', { status: 403 });
    }

    try {
        const validatedTarget = await validateProxyTargetUrl(url);
        if (!validatedTarget.ok) {
            return new NextResponse(validatedTarget.message, { status: validatedTarget.status });
        }

        // Rewrite IP-based URLs to use the virtual host from custom headers
        const rewritten = applyHostRewrite(validatedTarget.url, safeHeaders);
        const validatedRewrittenTarget = await validateProxyTargetUrl(rewritten.url);
        if (!validatedRewrittenTarget.ok) {
            return new NextResponse(validatedRewrittenTarget.message, { status: validatedRewrittenTarget.status });
        }

        const { upstream, requestUrl } = await fetchWithFallback(validatedRewrittenTarget.url, {
            method: request.method,
            cache: 'no-store',
            headers: {
                ...rewritten.headers,
                'Accept': '*/*',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
            },
        });
        const resolvedUrl = upstream.url || requestUrl;

        const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
        const lowerContentType = contentType.toLowerCase();
        const isMpd = contentType.includes('dash+xml') || resolvedUrl.includes('.mpd');
        const isM3u8 = lowerContentType.includes('mpegurl') || /\.m3u8(?:$|\?)/i.test(resolvedUrl);
        const isHead = request.method === 'HEAD';

        if (isHead) {
            return new NextResponse(null, {
                status: upstream.status,
                headers: {
                    'Content-Type': isMpd ? 'application/dash+xml' : (isM3u8 ? 'application/x-mpegURL' : normalizeContentType(resolvedUrl, contentType)),
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': ALLOW_METHODS,
                    'Cache-Control': 'no-store',
                },
            });
        }

        if (isMpd) {
            const text = await upstream.text();
            if (!upstream.ok) {
                return new NextResponse(text || `Upstream returned HTTP ${upstream.status}`, {
                    status: upstream.status,
                    headers: {
                        'Content-Type': normalizeContentType(resolvedUrl, contentType),
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': ALLOW_METHODS,
                        'Cache-Control': 'no-store',
                    },
                });
            }
            if (!isLikelyMpdXml(text)) {
                return new NextResponse(text || 'Upstream returned non-MPD payload', {
                    status: 502,
                    headers: {
                        'Content-Type': normalizeContentType(resolvedUrl, contentType),
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': ALLOW_METHODS,
                        'Cache-Control': 'no-store',
                    },
                });
            }
            const baseUrl = buildBaseUrl(resolvedUrl);

            let modified = text;
            if (!text.includes('<BaseURL>')) {
                modified = text.replace(
                    /(<MPD[^>]*>)/,
                    `$1\n  <BaseURL>${baseUrl}</BaseURL>`
                );
            }

            return new NextResponse(modified, {
                status: upstream.status,
                headers: {
                    'Content-Type': 'application/dash+xml',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': ALLOW_METHODS,
                    'Cache-Control': 'no-store',
                },
            });
        }

        if (isM3u8) {
            const text = await upstream.text();
            const modified = rewriteHlsManifest(text, resolvedUrl);

            return new NextResponse(modified, {
                status: upstream.status,
                headers: {
                    'Content-Type': 'application/x-mpegURL',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': ALLOW_METHODS,
                    'Cache-Control': 'no-store',
                },
            });
        }

        return new NextResponse(upstream.body, {
            status: upstream.status,
            headers: {
                'Content-Type': normalizeContentType(resolvedUrl, contentType),
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': ALLOW_METHODS,
                'Cache-Control': 'no-store',
            },
        });
    } catch (err: unknown) {
        const e = err as { message?: string };
        return new NextResponse(`Proxy error: ${e?.message || 'unknown error'}`, { status: 502 });
    }
}

export async function POST(request: NextRequest) {
    if (!isPlaybackAllowedForRequest(request)) {
        return new NextResponse('Maaf siaran tidak tersedia saat ini', { status: 503 });
    }

    const { url, safeHeaders, tokenValid } = getProxyTarget(request);

    if (!url) {
        return new NextResponse('Missing url param', { status: 400 });
    }
    if (!tokenValid) {
        return new NextResponse('Invalid or expired proxy token. Refresh playback to get a new token.', { status: 403 });
    }

    try {
        const validatedTarget = await validateProxyTargetUrl(url);
        if (!validatedTarget.ok) {
            return new NextResponse(validatedTarget.message, { status: validatedTarget.status });
        }

        const rewritten = applyHostRewrite(validatedTarget.url, safeHeaders);
        const validatedRewrittenTarget = await validateProxyTargetUrl(rewritten.url);
        if (!validatedRewrittenTarget.ok) {
            return new NextResponse(validatedRewrittenTarget.message, { status: validatedRewrittenTarget.status });
        }

        const body = await request.arrayBuffer();
        const upstream = await fetch(validatedRewrittenTarget.url, {
            method: 'POST',
            headers: buildPostForwardHeaders(request, rewritten.headers),
            body,
        });

        return new NextResponse(upstream.body, {
            status: upstream.status,
            headers: {
                'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': ALLOW_METHODS,
                'Cache-Control': 'no-store',
            },
        });
    } catch (err: unknown) {
        const e = err as { message?: string };
        return new NextResponse(`Proxy error: ${e?.message}`, { status: 502 });
    }
}

export async function HEAD(request: NextRequest) {
    return GET(request);
}

export async function OPTIONS() {
    return new NextResponse(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': ALLOW_METHODS,
            'Access-Control-Allow-Headers': '*',
        },
    });
}
