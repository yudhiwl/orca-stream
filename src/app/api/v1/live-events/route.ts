import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { sanitizeLiveEventForClient, sanitizeLiveEventsForClient } from '@/lib/playback-security';
import { getStreamSecret, upsertStreamSecret } from '@/lib/stream-secret-store';
import { requireAdminSession, getClientIp } from '@/lib/admin-session';
import { isStatefulWriteSupported } from '@/lib/runtime-storage';
import { checkRateLimit as checkRateLimitBucket } from '@/lib/rate-limit';

const DATA_FILE = path.join(process.cwd(), 'src', 'data', 'live-events.json');
const PUBLIC_LIVE_EVENTS_CACHE_HEADERS = {
    'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
};

function readEvents() {
    const data = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(data.replace(/^\uFEFF/, ''));
}

function writeEvents(events: unknown[]) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(events, null, 2), 'utf-8');
}

const LiveEventSchema = z.object({
    id: z.string().optional(),
    // Internal fields
    title: z.string().optional(),
    sport: z.string().optional(),
    category: z.string().default('Events'),
    competition: z.string().optional(),
    thumbnail: z.string().optional(),
    // Source-like aliases
    tagline: z.string().optional(),
    name: z.string().optional(),
    namespace: z.string().optional(),
    image: z.string().optional(),
    hls: z.string().min(1, 'URL Stream wajib diisi'),
    jenis: z.string().default('hls'),
    header_iptv: z.string().default(''),
    header_license: z.string().default(''),
    url_license: z.string().default(''),
    is_live: z.enum(['t', 'f']).default('f'),
    t_stamp: z.string().default('none'),
    s_stamp: z.string().default('none'),
});

type LiveEventInput = z.infer<typeof LiveEventSchema>;

function inferSport(text: string): string {
    const t = text.toLowerCase();
    if (t.includes('futsal')) return 'Futsal';
    if (t.includes('badminton') || t.includes('bulu tangkis')) return 'Bulu Tangkis';
    if (t.includes('formula 1') || t.includes('f1')) return 'Formula 1';
    if (t.includes('basket') || t.includes('nba')) return 'Basket';
    if (t.includes('tenis') || t.includes('tennis')) return 'Tenis';
    if (t.includes('voli') || t.includes('volley')) return 'Voli';
    if (t.includes('mma') || t.includes('ufc')) return 'MMA';
    return 'Sepak Bola';
}

function normalizeEventInput(data: LiveEventInput) {
    const title = (data.title ?? data.tagline ?? '').trim();
    const competition = (data.competition ?? data.name ?? data.namespace ?? '').trim();
    const thumbnail = (data.thumbnail ?? data.image ?? '').trim();
    const detectedSport = inferSport(`${title} ${competition}`);
    const sport = (data.sport ?? '').trim() || detectedSport;
    const category = (data.category ?? '').trim() || 'Events';

    return {
        title,
        sport,
        category,
        competition,
        hls: data.hls,
        jenis: data.jenis,
        header_iptv: data.header_iptv,
        header_license: data.header_license,
        url_license: data.url_license,
        thumbnail,
        is_live: data.is_live,
        t_stamp: data.t_stamp,
        s_stamp: data.s_stamp,
    };
}

async function mergeLiveEventSecret<T extends { id: string; hls?: string; header_iptv?: string; header_license?: string; url_license?: string }>(event: T): Promise<T> {
    const secret = await getStreamSecret('liveEvents', event.id);
    if (!secret) return event;

    return {
        ...event,
        hls: secret.hls ?? event.hls,
        header_iptv: secret.header_iptv ?? event.header_iptv,
        header_license: secret.header_license ?? event.header_license,
        url_license: secret.url_license ?? event.url_license,
    };
}

function revalidateLiveEventPages() {
    revalidatePath('/live-sports');
    revalidatePath('/watch/[id]/[slug]', 'page');
}

export async function GET(request: NextRequest) {
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimitBucket({
        namespace: 'api:v1:live-events:get',
        identifier: ip,
        limit: 60,
        windowSeconds: 60,
    });
    if (!rateLimit.allowed) {
        return new NextResponse('Too Many Requests', {
            status: 429,
            headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
        });
    }

    const activeOnly = request.nextUrl.searchParams.get('active') === 'true';
    const includeSecrets = request.nextUrl.searchParams.get('includeSecrets') === 'true';
    if (includeSecrets) {
        const unauthorized = requireAdminSession(request);
        if (unauthorized) return unauthorized;
    }
    const events = readEvents();
    const result = activeOnly ? events.filter((e: { is_live: string }) => e.is_live === 't') : events;
    if (includeSecrets) {
        const hydrated = await Promise.all(result.map((event: typeof result[number]) => mergeLiveEventSecret(event)));
        return NextResponse.json(hydrated, {
            headers: {
                'Cache-Control': 'no-store',
            },
        });
    }
    return NextResponse.json(sanitizeLiveEventsForClient(result), {
        headers: PUBLIC_LIVE_EVENTS_CACHE_HEADERS,
    });
}

export async function POST(request: NextRequest) {
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimitBucket({
        namespace: 'api:v1:live-events:post',
        identifier: ip,
        limit: 60,
        windowSeconds: 60,
    });
    if (!rateLimit.allowed) {
        return new NextResponse('Too Many Requests', {
            status: 429,
            headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
        });
    }

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
        const parsed = LiveEventSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
        }

        const normalized = normalizeEventInput(parsed.data);
        if (!normalized.title || !normalized.hls) {
            return NextResponse.json(
                { error: { formErrors: ['Tagline/title dan URL stream wajib diisi'] } },
                { status: 400 }
            );
        }

        const events = readEvents();
        const newEvent = {
            ...normalized,
            id: parsed.data.id?.trim() || `le-${Date.now()}`,
        };
        events.push(newEvent);
        writeEvents(events);
        await upsertStreamSecret('liveEvents', newEvent.id, {
            hls: parsed.data.hls,
            header_iptv: parsed.data.header_iptv,
            header_license: parsed.data.header_license,
            url_license: parsed.data.url_license,
        });
        revalidateLiveEventPages();
        return NextResponse.json(sanitizeLiveEventForClient(newEvent), { status: 201 });
    } catch {
        return NextResponse.json({ error: 'Gagal menyimpan event' }, { status: 500 });
    }
}
