import { LiveEvent } from '@/types/live-event';

const LIVE_FALLBACK_WINDOW_SECONDS = 3 * 60 * 60;

function parseUnixSeconds(raw: string | undefined): number | null {
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
}

function getEventStartSeconds(event: LiveEvent): number | null {
    return parseUnixSeconds(event.t_stamp);
}

function getEventEndSeconds(event: LiveEvent): number | null {
    return parseUnixSeconds(event.s_stamp);
}

function isLiveNow(event: LiveEvent, nowSeconds: number): boolean {
    const start = getEventStartSeconds(event);
    const end = getEventEndSeconds(event);

    if (start !== null && end !== null && end >= start) {
        return nowSeconds >= start && nowSeconds <= end;
    }

    if (start !== null) {
        return nowSeconds >= start && nowSeconds <= start + LIVE_FALLBACK_WINDOW_SECONDS;
    }

    // Final fallback when timestamps are absent: trust upstream live flag.
    return event.is_live === 't';
}

function isUpcoming(event: LiveEvent, nowSeconds: number): boolean {
    const start = getEventStartSeconds(event);
    return start !== null && nowSeconds < start;
}

export function buildPublicLiveSportsFeed(
    events: LiveEvent[],
    nowSeconds = Math.floor(Date.now() / 1000)
): { events: LiveEvent[]; liveCount: number } {
    const unique = new Map<string, LiveEvent>();

    for (const event of events) {
        const liveNow = isLiveNow(event, nowSeconds);
        const upcoming = !liveNow && isUpcoming(event, nowSeconds);
        if (!liveNow && !upcoming) continue;

        const normalized: LiveEvent = { ...event, is_live: liveNow ? 't' : 'f' };
        const key = event.id?.trim() || `${event.title}::${event.competition || ''}::${event.t_stamp || ''}`;

        if (!unique.has(key)) {
            unique.set(key, normalized);
            continue;
        }

        const existing = unique.get(key)!;
        if (existing.is_live !== 't' && normalized.is_live === 't') {
            unique.set(key, normalized);
        }
    }

    const nextEvents = Array.from(unique.values()).sort((a, b) => {
        const at = getEventStartSeconds(a);
        const bt = getEventStartSeconds(b);
        if (at === null && bt === null) return 0;
        if (at === null) return 1;
        if (bt === null) return -1;
        return at - bt;
    });

    return {
        events: nextEvents,
        liveCount: nextEvents.filter((event) => event.is_live === 't').length,
    };
}
