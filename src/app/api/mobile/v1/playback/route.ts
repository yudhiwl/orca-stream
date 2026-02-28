import { NextRequest, NextResponse } from 'next/server';
import { resolveChannelForPlayback } from '@/lib/playback-security';
import { resolvePlayback } from '@/lib/playback-resolver';
import { isMobilePlaybackEnabled } from '@/lib/player-settings';
import { requireMobileApiAuth } from '@/lib/mobile-api-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function resolveMobileJenis(
    rawJenis: string,
    streamUrl: string,
    drmType: 'none' | 'widevine' | 'clearkey'
): string {
    const baseJenis = String(rawJenis || '').trim().toLowerCase() || 'unknown';
    if (drmType === 'none') return baseJenis;

    const isDashLike = baseJenis.includes('dash') || streamUrl.toLowerCase().includes('.mpd');
    if (drmType === 'clearkey') {
        return isDashLike ? 'dash-clearkey' : `${baseJenis}-clearkey`;
    }
    if (drmType === 'widevine') {
        return isDashLike ? 'dash-widevine' : `${baseJenis}-widevine`;
    }

    return baseJenis;
}

function toAbsoluteUrl(request: NextRequest, value: string | null): string {
    const normalized = String(value ?? '').trim();
    if (!normalized) return '';
    // For mobile API, we prefer relative paths for local resources 
    // so the app can prepend its own API_BASE_URL.
    if (normalized.startsWith('/')) return normalized;
    try {
        return new URL(normalized, request.nextUrl.origin).toString();
    } catch {
        return normalized;
    }
}

export async function GET(request: NextRequest) {
    const unauthorized = requireMobileApiAuth(request);
    if (unauthorized) return unauthorized;

    if (!isMobilePlaybackEnabled()) {
        return NextResponse.json({ error: 'Maaf siaran tidak tersedia saat ini' }, { status: 503 });
    }

    const id = request.nextUrl.searchParams.get('id')?.trim();
    if (!id) {
        return NextResponse.json({ error: 'Missing channel id' }, { status: 400 });
    }

    const channel = resolveChannelForPlayback(id);
    if (!channel) {
        return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }
    if (!channel.hls) {
        return NextResponse.json({ error: 'Stream source unavailable' }, { status: 422 });
    }

    const resolved = resolvePlayback(channel, {
        proxyPath: '/api/mobile/v1/proxy',
        licensePath: '/api/mobile/v1/playback/license',
    });

    const isEventChannel = channel.id.startsWith('le-');
    const effectiveJenis = resolveMobileJenis(channel.jenis, channel.hls, resolved.drm.type);
    const payload = {
        channel: {
            id: channel.id,
            name: channel.name,
            image: channel.image,
            hls: toAbsoluteUrl(request, resolved.streamUrl),
            jenis: effectiveJenis,
            tagline: channel.tagline || '',
            subtitle: channel.subtitle || '',
            country_name: isEventChannel ? 'Events' : channel.country_name || '',
            countryname: isEventChannel ? 'Events' : channel.country_name || '',
            alpha_2_code: isEventChannel ? 'EV' : channel.alpha_2_code || '',
            alpha2code: isEventChannel ? 'EV' : channel.alpha_2_code || '',
            url_license: toAbsoluteUrl(request, resolved.drm.licenseProxyUrl),
            proxy_token: null,
        },
    };

    return NextResponse.json(payload, {
        headers: {
            'Cache-Control': 'no-store',
        },
    });
}
