import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
    applyAdminSession,
    clearFailedLoginAttempts,
    getLoginThrottle,
    isAdminConfigured,
    isValidAdminCredentials,
    recordFailedLoginAttempt,
} from '@/lib/admin-session';

const LoginSchema = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
});

export async function POST(request: NextRequest) {
    const throttle = getLoginThrottle(request);
    if (!throttle.allowed) {
        return NextResponse.json(
            { error: 'Terlalu banyak percobaan login. Coba lagi nanti.' },
            {
                status: 429,
                headers: {
                    'Retry-After': String(throttle.retryAfterSeconds),
                    'Cache-Control': 'no-store',
                },
            }
        );
    }

    if (!isAdminConfigured()) {
        return NextResponse.json(
            { error: 'Admin auth belum dikonfigurasi. Set ADMIN_USER dan ADMIN_PASS.' },
            { status: 503, headers: { 'Cache-Control': 'no-store' } }
        );
    }

    let payload: z.infer<typeof LoginSchema>;
    try {
        payload = LoginSchema.parse(await request.json());
    } catch {
        return NextResponse.json(
            { error: 'Username dan password wajib diisi.' },
            { status: 400 }
        );
    }

    const username = payload.username.trim();
    const password = payload.password;
    if (!isValidAdminCredentials(username, password)) {
        recordFailedLoginAttempt(request);
        const nextThrottle = getLoginThrottle(request);
        if (!nextThrottle.allowed) {
            return NextResponse.json(
                { error: 'Terlalu banyak percobaan login. Coba lagi nanti.' },
                {
                    status: 429,
                    headers: {
                        'Retry-After': String(nextThrottle.retryAfterSeconds),
                        'Cache-Control': 'no-store',
                    },
                }
            );
        }

        return NextResponse.json(
            { error: 'Username atau password salah.' },
            { status: 401, headers: { 'Cache-Control': 'no-store' } }
        );
    }

    clearFailedLoginAttempts(request);
    const response = NextResponse.json(
        { success: true },
        { headers: { 'Cache-Control': 'no-store' } }
    );
    return applyAdminSession(response, username);
}

