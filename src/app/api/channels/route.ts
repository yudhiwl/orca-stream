import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { Channel } from '@/types/channel';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { sanitizeChannelForClient, sanitizeChannelsForClient } from '@/lib/playback-security';
import { getStreamSecret, upsertStreamSecret } from '@/lib/stream-secret-store';
import { requireAdminSession } from '@/lib/admin-session';
import { isStatefulWriteSupported } from '@/lib/runtime-storage';

const DATA_FILE = path.join(process.cwd(), 'src', 'data', 'channels.json');
const PUBLIC_CHANNELS_CACHE_HEADERS = {
    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
};

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

const ChannelSchema = z.object({
    id: z.string().optional(),
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

type ChannelInput = z.infer<typeof ChannelSchema>;

function toTf(value: 't' | 'f' | boolean | undefined): 't' | 'f' {
    if (value === 't' || value === true) return 't';
    return 'f';
}

function normalizeCreateInput(input: ChannelInput) {
    return {
        name: (input.name ?? '').trim(),
        tagline: (input.tagline ?? '').trim(),
        hls: '',
        namespace: (input.namespace ?? input.name ?? '').trim(),
        is_live: toTf(input.is_live),
        is_movie: toTf(input.is_movie),
        subtitle: (input.subtitle ?? '').trim(),
        image: (input.image ?? '').trim(),
        jenis: (input.jenis ?? 'hls').trim() || 'hls',
        premium: toTf(input.premium),
        alpha_2_code: (input.alpha_2_code ?? input.country ?? 'ID').trim() || 'ID',
        country_name: (input.country_name ?? 'Indonesia').trim() || 'Indonesia',
        t_stamp: (input.t_stamp ?? 'none').trim() || 'none',
        s_stamp: (input.s_stamp ?? 'none').trim() || 'none',
        url_license: '',
        fake_event: toTf(input.fake_event),
        header_iptv: '',
        header_license: '',
        category: input.category || (input.country_name === 'Events' ? 'Events' : input.country_name || 'General'),
    };
}

function mergeChannelSecret(channel: Channel): Channel {
    const secret = getStreamSecret('channels', channel.id);
    if (!secret) return channel;

    return {
        ...channel,
        hls: secret.hls ?? channel.hls,
        url_license: secret.url_license ?? channel.url_license,
        header_iptv: secret.header_iptv ?? channel.header_iptv,
        header_license: secret.header_license ?? channel.header_license,
    };
}

function revalidatePublicChannelPages() {
    revalidatePath('/');
    revalidatePath('/channel-indonesia');
    revalidatePath('/channel-sport');
    revalidatePath('/movie');
    revalidatePath('/watch/[id]/[slug]', 'page');
}

export async function GET(request: NextRequest) {
    try {
        const channels = readChannels();
        const includeSecrets = request.nextUrl.searchParams.get('includeSecrets') === 'true';
        if (includeSecrets) {
            const unauthorized = requireAdminSession(request);
            if (unauthorized) return unauthorized;
            return NextResponse.json(channels.map(mergeChannelSecret), {
                headers: {
                    'Cache-Control': 'no-store',
                },
            });
        }
        return NextResponse.json(sanitizeChannelsForClient(channels), {
            headers: PUBLIC_CHANNELS_CACHE_HEADERS,
        });
    } catch {
        return NextResponse.json({ error: 'Failed to read channels' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
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
        const parsed = ChannelSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
        }

        const normalized = normalizeCreateInput(parsed.data);
        const sourceHls = (parsed.data.hls ?? '').trim();
        if (!normalized.name || !sourceHls) {
            return NextResponse.json(
                { error: { formErrors: ['name dan hls wajib diisi'] } },
                { status: 400 }
            );
        }

        const channels = readChannels();
        const newChannel = {
            id: parsed.data.id?.trim() || String(Date.now()),
            ...normalized,
        };
        channels.push(newChannel);
        writeChannels(channels);
        upsertStreamSecret('channels', newChannel.id, {
            hls: sourceHls,
            url_license: (parsed.data.url_license ?? '').trim(),
            header_iptv: parsed.data.header_iptv ?? '',
            header_license: parsed.data.header_license ?? '',
        });
        revalidatePublicChannelPages();
        return NextResponse.json(sanitizeChannelForClient(newChannel), { status: 201 });
    } catch {
        return NextResponse.json({ error: 'Failed to create channel' }, { status: 500 });
    }
}
