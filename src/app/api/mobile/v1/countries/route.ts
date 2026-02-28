import { NextRequest, NextResponse } from 'next/server';
import { listMobileCountries } from '@/lib/mobile-api-adapter';
import { MOBILE_API_CACHE_HEADERS, requireMobileApiAuth } from '@/lib/mobile-api-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
    const unauthorized = requireMobileApiAuth(request);
    if (unauthorized) return unauthorized;

    return NextResponse.json(listMobileCountries(), {
        headers: MOBILE_API_CACHE_HEADERS,
    });
}
