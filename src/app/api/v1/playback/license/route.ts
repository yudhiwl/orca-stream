import { NextRequest, NextResponse } from 'next/server';
import { buildClearKeyLicenseJson, getPlaybackToken } from '@/lib/playback-security';
import { isMobilePlaybackEnabled, isWebPlaybackEnabled } from '@/lib/player-settings';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function jsonError(message: string, status: number) {
    return NextResponse.json(
        { error: message },
        {
            status,
            headers: {
                'Cache-Control': 'no-store',
            },
        }
    );
}

async function handleLicenseRequest(request: NextRequest, method: 'GET' | 'POST') {
    const isMobileRequest = request.nextUrl.pathname.startsWith('/api/mobile/');
    const playbackEnabled = isMobileRequest ? isMobilePlaybackEnabled() : isWebPlaybackEnabled();
    if (!playbackEnabled) {
        return jsonError('Maaf siaran tidak tersedia saat ini', 503);
    }

    const token = request.nextUrl.searchParams.get('token')?.trim();
    if (!token) {
        return jsonError('Missing playback token', 400);
    }

    const payload = getPlaybackToken(token);
    if (!payload) {
        return jsonError('Invalid or expired playback token', 403);
    }

    if (payload.kind === 'clearkey-license') {
        const licenseJson = buildClearKeyLicenseJson(payload.clearKeyPayload);
        if (!licenseJson) {
            return jsonError('Invalid clearkey payload', 422);
        }

        return new NextResponse(licenseJson, {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store',
            },
        });
    }

    if (payload.kind !== 'widevine-license') {
        return jsonError('Unsupported token type for license endpoint', 422);
    }

    try {
        const body = method === 'POST' ? await request.arrayBuffer() : undefined;
        const upstream = await fetch(payload.licenseUrl, {
            method,
            cache: 'no-store',
            headers: {
                ...payload.licenseHeaders,
                'Accept': '*/*',
                ...(method === 'POST'
                    ? { 'Content-Type': request.headers.get('content-type') || 'application/octet-stream' }
                    : {}),
            },
            ...(method === 'POST' ? { body } : {}),
        });

        return new NextResponse(upstream.body, {
            status: upstream.status,
            headers: {
                'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
                'Cache-Control': 'no-store',
            },
        });
    } catch (error: unknown) {
        const e = error as { message?: string };
        return jsonError(`License proxy error: ${e?.message || 'Unknown error'}`, 502);
    }
}

export async function GET(request: NextRequest) {
    return handleLicenseRequest(request, 'GET');
}

export async function POST(request: NextRequest) {
    return handleLicenseRequest(request, 'POST');
}
