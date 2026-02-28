import { NextRequest, NextResponse } from 'next/server';

export const MOBILE_API_HEADER = 'x-orca-mobile-key';
export const MOBILE_API_CACHE_HEADERS: Readonly<Record<string, string>> = {
    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    Vary: MOBILE_API_HEADER,
};

function noStoreJson(payload: unknown, status: number) {
    return NextResponse.json(payload, {
        status,
        headers: {
            'Cache-Control': 'no-store',
        },
    });
}

export function requireMobileApiAuth(request: NextRequest): NextResponse | null {
    const expected = String(process.env.MOBILE_API_KEY ?? '').trim();
    if (!expected) {
        return noStoreJson(
            { error: 'MOBILE_API_KEY is not configured' },
            503
        );
    }

    const provided = String(request.headers.get(MOBILE_API_HEADER) ?? '').trim();
    if (!provided || provided !== expected) {
        return noStoreJson(
            { error: 'Unauthorized mobile API access' },
            401
        );
    }

    return null;
}
