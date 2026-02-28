import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { readPlayerSettings, writePlayerSettings } from '@/lib/player-settings';
import { requireAdminSession } from '@/lib/admin-session';
import { isStatefulWriteSupported } from '@/lib/runtime-storage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const UpdateSchema = z.object({
    playbackEnabled: z.boolean().optional(),
    playbackEnabledWeb: z.boolean().optional(),
    playbackEnabledMobile: z.boolean().optional(),
    prerollEnabled: z.boolean().optional(),
    prerollMode: z.enum(['test', 'production']).optional(),
    prerollDurationSeconds: z.number().int().min(1).max(30).optional(),
    prerollMediaUrl: z.string().optional(),
    prerollClickUrl: z.string().optional(),
    rightSidebarAdEnabled: z.boolean().optional(),
    rightSidebarAdType: z.enum(['image', 'iframe', 'script']).optional(),
    rightSidebarAdImageUrl: z.string().optional(),
    rightSidebarAdIframeUrl: z.string().optional(),
    rightSidebarAdScript: z.string().optional(),
    rightSidebarAdClickUrl: z.string().optional(),
    rightSidebarAdAltText: z.string().optional(),
    topPlayerAdEnabled: z.boolean().optional(),
    topPlayerAdType: z.enum(['image', 'iframe', 'script']).optional(),
    topPlayerAdImageUrl: z.string().optional(),
    topPlayerAdIframeUrl: z.string().optional(),
    topPlayerAdScript: z.string().optional(),
    topPlayerAdClickUrl: z.string().optional(),
    topPlayerAdAltText: z.string().optional(),
    topPlayerMobileFallbackEnabled: z.boolean().optional(),
    topPlayerMobileFallbackType: z.enum(['image', 'iframe', 'script']).optional(),
    topPlayerMobileFallbackImageUrl: z.string().optional(),
    topPlayerMobileFallbackIframeUrl: z.string().optional(),
    topPlayerMobileFallbackScript: z.string().optional(),
    topPlayerMobileFallbackClickUrl: z.string().optional(),
    topPlayerMobileFallbackAltText: z.string().optional(),
});

export async function GET(request: NextRequest) {
    const unauthorized = requireAdminSession(request);
    if (unauthorized) return unauthorized;

    return NextResponse.json(readPlayerSettings(), {
        headers: {
            'Cache-Control': 'no-store',
        },
    });
}

export async function PUT(request: NextRequest) {
    const unauthorized = requireAdminSession(request);
    if (unauthorized) return unauthorized;
    if (!isStatefulWriteSupported()) {
        return NextResponse.json(
            { error: 'Write operation tidak didukung di deployment ini. Gunakan single-instance server.' },
            { status: 503 }
        );
    }

    try {
        const body = await request.json();
        const parsed = UpdateSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
        }

        const updated = writePlayerSettings({
            playbackEnabled: parsed.data.playbackEnabled,
            playbackEnabledWeb: parsed.data.playbackEnabledWeb,
            playbackEnabledMobile: parsed.data.playbackEnabledMobile,
            prerollEnabled: parsed.data.prerollEnabled,
            prerollMode: parsed.data.prerollMode,
            prerollDurationSeconds: parsed.data.prerollDurationSeconds,
            prerollMediaUrl: parsed.data.prerollMediaUrl,
            prerollClickUrl: parsed.data.prerollClickUrl,
            rightSidebarAdEnabled: parsed.data.rightSidebarAdEnabled,
            rightSidebarAdType: parsed.data.rightSidebarAdType,
            rightSidebarAdImageUrl: parsed.data.rightSidebarAdImageUrl,
            rightSidebarAdIframeUrl: parsed.data.rightSidebarAdIframeUrl,
            rightSidebarAdScript: parsed.data.rightSidebarAdScript,
            rightSidebarAdClickUrl: parsed.data.rightSidebarAdClickUrl,
            rightSidebarAdAltText: parsed.data.rightSidebarAdAltText,
            topPlayerAdEnabled: parsed.data.topPlayerAdEnabled,
            topPlayerAdType: parsed.data.topPlayerAdType,
            topPlayerAdImageUrl: parsed.data.topPlayerAdImageUrl,
            topPlayerAdIframeUrl: parsed.data.topPlayerAdIframeUrl,
            topPlayerAdScript: parsed.data.topPlayerAdScript,
            topPlayerAdClickUrl: parsed.data.topPlayerAdClickUrl,
            topPlayerAdAltText: parsed.data.topPlayerAdAltText,
            topPlayerMobileFallbackEnabled: parsed.data.topPlayerMobileFallbackEnabled,
            topPlayerMobileFallbackType: parsed.data.topPlayerMobileFallbackType,
            topPlayerMobileFallbackImageUrl: parsed.data.topPlayerMobileFallbackImageUrl,
            topPlayerMobileFallbackIframeUrl: parsed.data.topPlayerMobileFallbackIframeUrl,
            topPlayerMobileFallbackScript: parsed.data.topPlayerMobileFallbackScript,
            topPlayerMobileFallbackClickUrl: parsed.data.topPlayerMobileFallbackClickUrl,
            topPlayerMobileFallbackAltText: parsed.data.topPlayerMobileFallbackAltText,
        });

        return NextResponse.json(updated, {
            headers: {
                'Cache-Control': 'no-store',
            },
        });
    } catch {
        return NextResponse.json({ error: 'Failed to update player settings' }, { status: 500 });
    }
}
