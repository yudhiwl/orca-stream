import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { Channel } from '@/types/channel';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { sanitizeChannelForClient } from '@/lib/playback-security';
import { deleteStreamSecret, upsertStreamSecret } from '@/lib/stream-secret-store';
import { requireAdminSession } from '@/lib/admin-session';
import { isStatefulWriteSupported } from '@/lib/runtime-storage';

const DATA_FILE = path.join(process.cwd(), 'src', 'data', 'channels.json');

function readChannels() {
    const data = fs.readFileSync(DATA_FILE, 'utf-8');
    const raw = data.replace(/^\uFEFF/, '').trim();
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Channel[]) : [];
}

function writeChannels(channels: unknown[]) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(channels, null, 2), 'utf-8');
}

const UpdateSchema = z.object({
    name: z.string().optional(),
    tagline: z.string().optional(),
    hls: z.string().optional(),
    namespace: z.string().optional(),
    is_live: z.union([z.enum(['t', 'f']), z.boolean()]).optional(),
    is_movie: z.union([z.enum(['t', 'f']), z.boolean()]).optional(),
    subtitle: z.string().optional(),
    image: z.string().optional(),
    jenis: z.string().optional(),
    premium: z.union([z.enum(['t', 'f']), z.boolean()]).optional(),
    alpha_2_code: z.string().optional(),
    country: z.string().optional(),
    country_name: z.string().optional(),
    t_stamp: z.string().optional(),
    s_stamp: z.string().optional(),
    url_license: z.string().optional(),
    fake_event: z.union([z.enum(['t', 'f']), z.boolean()]).optional(),
    header_iptv: z.string().optional(),
    header_license: z.string().optional(),
    category: z.string().optional(),
});

type UpdateInput = z.infer<typeof UpdateSchema>;

function toTf(value: 't' | 'f' | boolean | undefined): 't' | 'f' {
    if (value === 't' || value === true) return 't';
    return 'f';
}

function normalizeUpdateInput(input: UpdateInput) {
    const next: Partial<Channel> = {};

    if (Object.prototype.hasOwnProperty.call(input, 'name')) next.name = (input.name ?? '').trim();
    if (Object.prototype.hasOwnProperty.call(input, 'tagline')) next.tagline = (input.tagline ?? '').trim();
    // hls is stored in server-side secret store.
    if (Object.prototype.hasOwnProperty.call(input, 'namespace')) next.namespace = (input.namespace ?? '').trim();
    if (Object.prototype.hasOwnProperty.call(input, 'is_live')) next.is_live = toTf(input.is_live);
    if (Object.prototype.hasOwnProperty.call(input, 'is_movie')) next.is_movie = toTf(input.is_movie);
    if (Object.prototype.hasOwnProperty.call(input, 'subtitle')) next.subtitle = (input.subtitle ?? '').trim();
    if (Object.prototype.hasOwnProperty.call(input, 'image')) next.image = (input.image ?? '').trim();
    if (Object.prototype.hasOwnProperty.call(input, 'jenis')) next.jenis = (input.jenis ?? '').trim();
    if (Object.prototype.hasOwnProperty.call(input, 'premium')) next.premium = toTf(input.premium);
    if (
        Object.prototype.hasOwnProperty.call(input, 'alpha_2_code') ||
        Object.prototype.hasOwnProperty.call(input, 'country')
    ) {
        next.alpha_2_code = (input.alpha_2_code ?? input.country ?? '').trim();
    }
    if (Object.prototype.hasOwnProperty.call(input, 'country_name')) next.country_name = (input.country_name ?? '').trim();
    if (Object.prototype.hasOwnProperty.call(input, 't_stamp')) next.t_stamp = (input.t_stamp ?? '').trim();
    if (Object.prototype.hasOwnProperty.call(input, 's_stamp')) next.s_stamp = (input.s_stamp ?? '').trim();
    // url_license is stored in server-side secret store.
    if (Object.prototype.hasOwnProperty.call(input, 'fake_event')) next.fake_event = toTf(input.fake_event);
    // header_iptv/header_license are stored in server-side secret store.
    if (Object.prototype.hasOwnProperty.call(input, 'category')) next.category = (input.category ?? '').trim();

    return next;
}

function revalidatePublicChannelPages() {
    revalidatePath('/');
    revalidatePath('/channel-indonesia');
    revalidatePath('/channel-sport');
    revalidatePath('/movie');
    revalidatePath('/watch/[id]/[slug]', 'page');
}

// Next.js 15+ requires params to be awaited
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

        const normalized = normalizeUpdateInput(parsed.data);
        const secretPatch: Record<string, string> = {};
        if (Object.prototype.hasOwnProperty.call(parsed.data, 'hls')) secretPatch.hls = (parsed.data.hls ?? '').trim();
        if (Object.prototype.hasOwnProperty.call(parsed.data, 'url_license')) secretPatch.url_license = (parsed.data.url_license ?? '').trim();
        if (Object.prototype.hasOwnProperty.call(parsed.data, 'header_iptv')) secretPatch.header_iptv = parsed.data.header_iptv ?? '';
        if (Object.prototype.hasOwnProperty.call(parsed.data, 'header_license')) secretPatch.header_license = parsed.data.header_license ?? '';
        const channels = readChannels();
        const index = channels.findIndex((c) => c.id === id);
        if (index === -1) {
            return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
        }
        channels[index] = { ...channels[index], ...normalized };
        writeChannels(channels);
        if (Object.keys(secretPatch).length > 0) {
            upsertStreamSecret('channels', id, secretPatch);
        }
        revalidatePublicChannelPages();
        return NextResponse.json(sanitizeChannelForClient(channels[index]));
    } catch {
        return NextResponse.json({ error: 'Failed to update channel' }, { status: 500 });
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
        const channels = readChannels();
        const filtered = channels.filter((c) => c.id !== id);
        if (filtered.length === channels.length) {
            return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
        }
        writeChannels(filtered);
        deleteStreamSecret('channels', id);
        revalidatePublicChannelPages();
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Failed to delete channel' }, { status: 500 });
    }
}
