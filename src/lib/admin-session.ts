import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

const ADMIN_SESSION_COOKIE = 'orca_admin_session';
const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12; // 12 jam
const MAX_FAILED_ATTEMPTS = 5;
const FAILED_ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 menit

const failedAttemptsByIp = new Map<string, { count: number; resetAt: number }>();

function getAdminUser() {
    return (process.env.ADMIN_USER ?? '').trim();
}

function getAdminPass() {
    return (process.env.ADMIN_PASS ?? '').trim();
}

function getSessionSecret() {
    const fromEnv = (process.env.ADMIN_SESSION_SECRET ?? '').trim();
    if (fromEnv) return fromEnv;

    if (process.env.NODE_ENV === 'production') {
        throw new Error('ADMIN_SESSION_SECRET must be set in production');
    }
    // Fallback for development only - still better than predictable user:pass
    return 'dev-secret-only-change-in-production';
}
export function getClientIp(request: NextRequest) {
    const xForwardedFor = request.headers.get('x-forwarded-for');
    if (xForwardedFor) {
        const first = xForwardedFor.split(',')[0]?.trim();
        if (first) return first;
    }

    return (
        request.headers.get('x-real-ip') ||
        request.headers.get('cf-connecting-ip') ||
        'unknown'
    );
}

function sign(payload: string) {
    return crypto
        .createHmac('sha256', getSessionSecret())
        .update(payload)
        .digest('base64url');
}

function buildToken(username: string, expiresAt: number) {
    const payload = `${username}:${expiresAt}`;
    return `${payload}:${sign(payload)}`;
}

function parseToken(token: string | null | undefined) {
    if (!token) return null;
    const firstSep = token.indexOf(':');
    const secondSep = token.indexOf(':', firstSep + 1);
    if (firstSep <= 0 || secondSep <= firstSep) return null;

    const username = token.slice(0, firstSep);
    const expiresRaw = token.slice(firstSep + 1, secondSep);
    const signature = token.slice(secondSep + 1);
    const expiresAt = Number(expiresRaw);
    if (!Number.isFinite(expiresAt) || !signature) return null;

    const payload = `${username}:${expiresAt}`;
    if (sign(payload) !== signature) return null;
    if (expiresAt <= Date.now()) return null;
    if (username !== getAdminUser()) return null;

    return { username, expiresAt };
}

function clearExpiredFailedAttempts(now: number) {
    for (const [ip, record] of failedAttemptsByIp) {
        if (record.resetAt <= now) {
            failedAttemptsByIp.delete(ip);
        }
    }
}

function timingSafeCompare(left: string, right: string): boolean {
    const leftBuf = Buffer.from(left);
    const rightBuf = Buffer.from(right);
    const max = Math.max(leftBuf.length, rightBuf.length, 1);
    const paddedLeft = Buffer.alloc(max);
    const paddedRight = Buffer.alloc(max);
    leftBuf.copy(paddedLeft);
    rightBuf.copy(paddedRight);
    const same = crypto.timingSafeEqual(paddedLeft, paddedRight);
    return same && leftBuf.length === rightBuf.length;
}

export function isAdminConfigured() {
    return Boolean(getAdminUser() && getAdminPass());
}

export function isValidAdminCredentials(username: string, password: string) {
    const expectedUser = getAdminUser();
    const expectedPass = getAdminPass();
    if (!expectedUser || !expectedPass) return false;
    return timingSafeCompare(username, expectedUser) && timingSafeCompare(password, expectedPass);
}

export function isAdminAuthenticated(request: NextRequest) {
    const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    return Boolean(parseToken(token));
}

export function requireAdminSession(request: NextRequest) {
    if (isAdminAuthenticated(request)) return null;

    return NextResponse.json(
        { error: 'Unauthorized' },
        {
            status: 401,
            headers: { 'Cache-Control': 'no-store' },
        }
    );
}

export function applyAdminSession(response: NextResponse, username: string) {
    const expiresAt = Date.now() + ADMIN_SESSION_MAX_AGE_SECONDS * 1000;
    response.cookies.set({
        name: ADMIN_SESSION_COOKIE,
        value: buildToken(username, expiresAt),
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    });
    return response;
}

export function clearAdminSession(response: NextResponse) {
    response.cookies.set({
        name: ADMIN_SESSION_COOKIE,
        value: '',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 0,
    });
    return response;
}

export function getLoginThrottle(request: NextRequest) {
    const now = Date.now();
    clearExpiredFailedAttempts(now);

    const ip = getClientIp(request);
    const current = failedAttemptsByIp.get(ip);

    if (!current || current.resetAt <= now || current.count < MAX_FAILED_ATTEMPTS) {
        return { allowed: true as const, retryAfterSeconds: 0 };
    }

    return {
        allowed: false as const,
        retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
}

export function recordFailedLoginAttempt(request: NextRequest) {
    const now = Date.now();
    clearExpiredFailedAttempts(now);

    const ip = getClientIp(request);
    const current = failedAttemptsByIp.get(ip);
    const next = current && current.resetAt > now
        ? { count: current.count + 1, resetAt: current.resetAt }
        : { count: 1, resetAt: now + FAILED_ATTEMPT_WINDOW_MS };

    failedAttemptsByIp.set(ip, next);
    return next.count;
}

export function clearFailedLoginAttempts(request: NextRequest) {
    failedAttemptsByIp.delete(getClientIp(request));
}
