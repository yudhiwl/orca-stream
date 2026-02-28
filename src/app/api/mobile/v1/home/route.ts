import { NextRequest, NextResponse } from 'next/server';
import { buildMobileHomeSections } from '@/lib/mobile-api-adapter';
import { MOBILE_API_CACHE_HEADERS, requireMobileApiAuth } from '@/lib/mobile-api-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
    const unauthorized = requireMobileApiAuth(request);
    if (unauthorized) return unauthorized;

    const sections = buildMobileHomeSections();
    return NextResponse.json(
        {
            featured: sections.featured,
            live_now: sections.liveNow,
            upcoming: sections.upcoming,
        },
        {
            headers: MOBILE_API_CACHE_HEADERS,
        }
    );
}
