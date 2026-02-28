import { NextRequest, NextResponse } from 'next/server';
import { resolveChannelForPlayback } from '@/lib/playback-security';
import { resolvePlayback } from '@/lib/playback-resolver';
import { isMobilePlaybackEnabled } from '@/lib/player-settings';
import { requireMobileApiAuth } from '@/lib/mobile-api-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function toAbsoluteUrl(request: NextRequest, value: string | null): string | null {
    const normalized = String(value ?? '').trim();
    if (!normalized) return null;
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

    const playback = resolvePlayback(channel, {
        proxyPath: '/api/mobile/v1/proxy',
        licensePath: '/api/mobile/v1/playback/license',
    });

    return NextResponse.json(
        {
            channelId: channel.id,
            streamUrl: toAbsoluteUrl(request, playback.streamUrl),
            shouldProxy: playback.shouldProxy,
            proxyToken: null,
            drm: {
                type: playback.drm.type,
                licenseProxyUrl: toAbsoluteUrl(request, playback.drm.licenseProxyUrl),
            },
        },
        {
            headers: {
                'Cache-Control': 'no-store',
            },
        }
    );
}
