import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-session';

export async function GET(request: NextRequest) {
    return NextResponse.json(
        { authenticated: isAdminAuthenticated(request) },
        { headers: { 'Cache-Control': 'no-store' } }
    );
}

