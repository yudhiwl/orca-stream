import { NextResponse } from 'next/server';
import { readPublicUiSettings } from '@/lib/ui-settings-public';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const UI_SETTINGS_CACHE_HEADERS = {
    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
};

export async function GET() {
    return NextResponse.json(
        readPublicUiSettings(),
        {
            headers: UI_SETTINGS_CACHE_HEADERS,
        }
    );
}
