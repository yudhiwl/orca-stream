import { NextResponse } from 'next/server';

export function proxy() {
    return NextResponse.next();
}

export const config = {
    matcher: ['/__orcastream_proxy_disabled__'],
};
