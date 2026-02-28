import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Channel } from '@/types/channel';
import { sanitizeChannelForClient } from '@/lib/playback-security';

const DATA_FILE = path.join(process.cwd(), 'src', 'data', 'channels.json');

type ResolveResponse = {
    channel: Channel;
    refreshed: boolean;
    expiresAt: number | null;
    warning: string | null;
};

function readChannels(): Channel[] {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8').replace(/^\uFEFF/, '').trim();
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Channel[]) : [];
}

function noStoreJson(payload: ResolveResponse, status = 200) {
    return NextResponse.json(payload, {
        status,
        headers: {
            'Cache-Control': 'no-store',
        },
    });
}

export async function GET(request: NextRequest) {
    const id = request.nextUrl.searchParams.get('id')?.trim();
    if (!id) {
        return NextResponse.json({ error: 'Missing channel id' }, { status: 400 });
    }

    try {
        const channels = readChannels();
        const channel = channels.find((item) => item.id === id);
        if (!channel) {
            return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
        }

        return noStoreJson({
            channel: sanitizeChannelForClient(channel),
            refreshed: false,
            expiresAt: null,
            warning: null,
        });
    } catch {
        return NextResponse.json({ error: 'Failed to read channel data' }, { status: 500 });
    }
}
