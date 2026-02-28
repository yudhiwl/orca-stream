import { NextRequest, NextResponse } from 'next/server';
import { resolveChannelForPlayback } from '@/lib/playback-security';
import { resolvePlayback } from '@/lib/playback-resolver';
import { isWebPlaybackEnabled } from '@/lib/player-settings';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PlaybackResolveResponse = {
    channelId: string;
    streamUrl: string;
    shouldProxy: boolean;
    proxyToken: string | null;
    drm: {
        type: 'none' | 'widevine' | 'clearkey';
        licenseProxyUrl: string | null;
    };
};

function noStoreJson(payload: PlaybackResolveResponse, status = 200) {
    return NextResponse.json(payload, {
        status,
        headers: {
            'Cache-Control': 'no-store',
        },
    });
}

export async function GET(request: NextRequest) {
    if (!isWebPlaybackEnabled()) {
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
        proxyPath: '/api/proxy',
        licensePath: '/api/v1/playback/license',
    });

    return noStoreJson({
        channelId: channel.id,
        ...playback,
    });
}
