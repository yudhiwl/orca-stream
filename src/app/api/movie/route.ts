import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import type { Channel } from '@/types/channel';
import { sanitizeChannelsForClient } from '@/lib/playback-security';
import { checkRateLimit } from '@/lib/rate-limit';

const MOVIE_FILE = path.join(process.cwd(), 'src', 'data', 'movie.json');
const PUBLIC_MOVIES_CACHE_HEADERS = {
    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
};

interface MovieDataFile {
    info?: Channel[];
}

function readMovieChannels(): Channel[] {
    try {
        const raw = fs.readFileSync(MOVIE_FILE, 'utf-8').replace(/^\uFEFF/, '').trim();
        if (!raw) return [];
        const parsed = JSON.parse(raw) as MovieDataFile;
        return Array.isArray(parsed?.info) ? parsed.info : [];
    } catch {
        return [];
    }
}

export async function GET(request: Request): Promise<NextResponse> {
    const xForwardedFor = request.headers.get('x-forwarded-for');
    const ip =
        xForwardedFor?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip')
        || request.headers.get('cf-connecting-ip')
        || 'unknown';

    const rateLimit = await checkRateLimit({
        namespace: 'api:movie',
        identifier: ip,
        limit: 60,
        windowSeconds: 60,
    });

    if (!rateLimit.allowed) {
        return NextResponse.json(
            { error: 'Too many requests' },
            {
                status: 429,
                headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
            }
        );
    }

    const channels = readMovieChannels();
    return NextResponse.json(sanitizeChannelsForClient(channels), {
        headers: PUBLIC_MOVIES_CACHE_HEADERS,
    });
}
