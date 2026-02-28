import { NextRequest, NextResponse } from 'next/server';
import { filterMobileChannelsByCode } from '@/lib/mobile-api-adapter';
import { MOBILE_API_CACHE_HEADERS, requireMobileApiAuth } from '@/lib/mobile-api-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
    const unauthorized = requireMobileApiAuth(request);
    if (unauthorized) return unauthorized;

    const code = request.nextUrl.searchParams.get('code')?.trim();
    if (!code) {
        return NextResponse.json({ error: 'Missing code' }, { status: 400 });
    }

    const result = filterMobileChannelsByCode(code);
    return NextResponse.json(
        {
            country_name: result.name,
            country: result.code,
            info: result.channels,
        },
        {
            headers: MOBILE_API_CACHE_HEADERS,
        }
    );
}
