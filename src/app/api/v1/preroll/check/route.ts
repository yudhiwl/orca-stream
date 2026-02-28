import { NextRequest, NextResponse } from 'next/server';
import { readPlayerSettings } from '@/lib/player-settings';
import { resolvePrerollAd } from '@/lib/preroll-ad-resolver';
import { hasSeenPrerollToday, markPrerollSeenToday } from '@/lib/preroll-impression-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PrerollCheckResponse = {
    enabled: boolean;
    shouldShow: boolean;
    durationSeconds: number;
    mediaUrl: string;
    mediaType: 'video' | 'image';
    clickUrl: string;
};

function noStoreJson(payload: PrerollCheckResponse) {
    return NextResponse.json(payload, {
        headers: {
            'Cache-Control': 'no-store',
        },
    });
}

function getClientIp(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
        const first = forwarded.split(',')[0]?.trim();
        if (first) return first;
    }

    const candidates = [
        request.headers.get('cf-connecting-ip'),
        request.headers.get('x-real-ip'),
    ];

    for (const value of candidates) {
        const trimmed = String(value ?? '').trim();
        if (trimmed) return trimmed;
    }

    return 'local';
}

export async function GET(request: NextRequest) {
    const settings = readPlayerSettings();
    const mediaUrl = settings.prerollMediaUrl.trim();
    const enabled = settings.playbackEnabledWeb && settings.prerollEnabled && mediaUrl.length > 0;

    if (!enabled) {
        return noStoreJson({
            enabled: false,
            shouldShow: false,
            durationSeconds: settings.prerollDurationSeconds,
            mediaUrl: '',
            mediaType: 'video',
            clickUrl: '',
        });
    }

    if (settings.prerollMode === 'production') {
        const clientIp = getClientIp(request);
        if (hasSeenPrerollToday(clientIp)) {
            return noStoreJson({
                enabled: true,
                shouldShow: false,
                durationSeconds: settings.prerollDurationSeconds,
                mediaUrl: '',
                mediaType: 'video',
                clickUrl: '',
            });
        }
    }

    const resolved = await resolvePrerollAd(mediaUrl);
    if (!resolved) {
        return noStoreJson({
            enabled: true,
            shouldShow: false,
            durationSeconds: settings.prerollDurationSeconds,
            mediaUrl: '',
            mediaType: 'video',
            clickUrl: '',
        });
    }

    if (settings.prerollMode === 'production') {
        markPrerollSeenToday(getClientIp(request));
    }

    return noStoreJson({
        enabled: true,
        shouldShow: true,
        durationSeconds: settings.prerollDurationSeconds,
        mediaUrl: resolved.mediaUrl,
        mediaType: resolved.mediaType,
        clickUrl: settings.prerollClickUrl || resolved.clickUrl,
    });
}
