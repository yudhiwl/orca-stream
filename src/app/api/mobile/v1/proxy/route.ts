import {
    GET as baseGet,
    POST as basePost,
    OPTIONS as baseOptions,
} from '@/app/api/proxy/route';
import { NextRequest } from 'next/server';
import { requireMobileApiAuth } from '@/lib/mobile-api-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
    const unauthorized = requireMobileApiAuth(request);
    if (unauthorized) return unauthorized;
    return baseGet(request);
}

export async function POST(request: NextRequest) {
    const unauthorized = requireMobileApiAuth(request);
    if (unauthorized) return unauthorized;
    return basePost(request);
}

export async function OPTIONS(request: NextRequest) {
    const unauthorized = requireMobileApiAuth(request);
    if (unauthorized) return unauthorized;
    return baseOptions();
}
