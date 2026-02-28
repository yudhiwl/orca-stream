import { NextRequest, NextResponse } from 'next/server';
import { buildMobileRelatedChannels } from '@/lib/mobile-api-adapter';
import { MOBILE_API_CACHE_HEADERS, requireMobileApiAuth } from '@/lib/mobile-api-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
    const unauthorized = requireMobileApiAuth(request);
    if (unauthorized) return unauthorized;

    const id = request.nextUrl.searchParams.get('id')?.trim();
    const limitParam = request.nextUrl.searchParams.get('limit')?.trim();
    const limit = Number(limitParam);

    if (!id) {
        return NextResponse.json({ error: 'Missing channel id' }, { status: 400 });
    }

    return NextResponse.json(buildMobileRelatedChannels(id, limit), {
        headers: MOBILE_API_CACHE_HEADERS,
    });
}
