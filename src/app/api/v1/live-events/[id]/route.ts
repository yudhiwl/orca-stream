import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { sanitizeLiveEventForClient } from '@/lib/playback-security';
import { deleteStreamSecret, upsertStreamSecret } from '@/lib/stream-secret-store';
import { requireAdminSession } from '@/lib/admin-session';
import { isStatefulWriteSupported } from '@/lib/runtime-storage';

const DATA_FILE = path.join(process.cwd(), 'src', 'data', 'live-events.json');

function readEvents() {
    const data = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(data.replace(/^\uFEFF/, ''));
}

function writeEvents(events: unknown[]) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(events, null, 2), 'utf-8');
}

const UpdateSchema = z.object({
    // Internal fields
    title: z.string().min(1).optional(),
    sport: z.string().optional(),
    category: z.string().optional(),
    competition: z.string().optional(),
    thumbnail: z.string().optional(),
    // Source-like aliases
    tagline: z.string().optional(),
    name: z.string().optional(),
    namespace: z.string().optional(),
    image: z.string().optional(),
    hls: z.string().optional(),
    jenis: z.string().optional(),
    header_iptv: z.string().optional(),
    header_license: z.string().optional(),
    url_license: z.string().optional(),
    is_live: z.enum(['t', 'f']).optional(),
    t_stamp: z.string().optional(),
    s_stamp: z.string().optional(),
});

type UpdateInput = z.infer<typeof UpdateSchema>;

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

function normalizePartialUpdate(input: UpdateInput) {
    const next: Record<string, string> = {};

    if (Object.prototype.hasOwnProperty.call(input, 'title') || Object.prototype.hasOwnProperty.call(input, 'tagline')) {
        next.title = (input.title ?? input.tagline ?? '').trim();
    }

    if (
        Object.prototype.hasOwnProperty.call(input, 'competition') ||
        Object.prototype.hasOwnProperty.call(input, 'name') ||
        Object.prototype.hasOwnProperty.call(input, 'namespace')
    ) {
        next.competition = (input.competition ?? input.name ?? input.namespace ?? '').trim();
    }

    if (Object.prototype.hasOwnProperty.call(input, 'thumbnail') || Object.prototype.hasOwnProperty.call(input, 'image')) {
        next.thumbnail = (input.thumbnail ?? input.image ?? '').trim();
    }

    if (Object.prototype.hasOwnProperty.call(input, 'sport')) {
        next.sport = (input.sport ?? '').trim();
    } else if (Object.prototype.hasOwnProperty.call(next, 'title') || Object.prototype.hasOwnProperty.call(next, 'competition')) {
        const detected = inferSport(`${next.title ?? ''} ${next.competition ?? ''}`);
        next.sport = detected;
    }

    if (Object.prototype.hasOwnProperty.call(input, 'category')) {
        next.category = (input.category ?? '').trim() || 'Events';
    }

    // hls is stored in server-side secret store.
    if (Object.prototype.hasOwnProperty.call(input, 'jenis') && input.jenis !== undefined) next.jenis = input.jenis;
    // header_iptv/header_license/url_license are stored in server-side secret store.
    if (Object.prototype.hasOwnProperty.call(input, 'is_live') && input.is_live !== undefined) next.is_live = input.is_live;
    if (Object.prototype.hasOwnProperty.call(input, 't_stamp') && input.t_stamp !== undefined) next.t_stamp = input.t_stamp;
    if (Object.prototype.hasOwnProperty.call(input, 's_stamp') && input.s_stamp !== undefined) next.s_stamp = input.s_stamp;

    return next;
}

function revalidateLiveEventPages() {
    revalidatePath('/live-sports');
    revalidatePath('/watch/[id]/[slug]', 'page');
}

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: RouteContext) {
    const unauthorized = requireAdminSession(request);
    if (unauthorized) return unauthorized;
    if (!isStatefulWriteSupported()) {
        return NextResponse.json(
            { error: 'Write operation tidak didukung di deployment ini. Gunakan single-instance server.' },
            { status: 503 }
        );
    }

    try {
        const { id } = await context.params;
        const body = await request.json();
        const parsed = UpdateSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
        }
        const normalized = normalizePartialUpdate(parsed.data);
        const secretPatch: Record<string, string> = {};
        if (Object.prototype.hasOwnProperty.call(parsed.data, 'hls')) secretPatch.hls = parsed.data.hls ?? '';
        if (Object.prototype.hasOwnProperty.call(parsed.data, 'header_iptv')) secretPatch.header_iptv = parsed.data.header_iptv ?? '';
        if (Object.prototype.hasOwnProperty.call(parsed.data, 'header_license')) secretPatch.header_license = parsed.data.header_license ?? '';
        if (Object.prototype.hasOwnProperty.call(parsed.data, 'url_license')) secretPatch.url_license = parsed.data.url_license ?? '';

        const events = readEvents();
        const index = events.findIndex((e: { id: string }) => e.id === id);
        if (index === -1) {
            return NextResponse.json({ error: 'Event tidak ditemukan' }, { status: 404 });
        }
        events[index] = { ...events[index], ...normalized };
        writeEvents(events);
        if (Object.keys(secretPatch).length > 0) {
            upsertStreamSecret('liveEvents', id, secretPatch);
        }
        revalidateLiveEventPages();
        return NextResponse.json(sanitizeLiveEventForClient(events[index]));
    } catch {
        return NextResponse.json({ error: 'Gagal update event' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
    const unauthorized = requireAdminSession(request);
    if (unauthorized) return unauthorized;
    if (!isStatefulWriteSupported()) {
        return NextResponse.json(
            { error: 'Write operation tidak didukung di deployment ini. Gunakan single-instance server.' },
            { status: 503 }
        );
    }

    try {
        const { id } = await context.params;
        const events = readEvents();
        const filtered = events.filter((e: { id: string }) => e.id !== id);
        if (filtered.length === events.length) {
            return NextResponse.json({ error: 'Event tidak ditemukan' }, { status: 404 });
        }
        writeEvents(filtered);
        deleteStreamSecret('liveEvents', id);
        revalidateLiveEventPages();
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Gagal hapus event' }, { status: 500 });
    }
}
