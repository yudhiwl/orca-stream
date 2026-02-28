const LIVE_EVENT_PREFIX = 'le-';

export function isLiveEventWatchId(id: string): boolean {
    return id.startsWith(LIVE_EVENT_PREFIX);
}

export function toLiveEventWatchId(eventId: string): string {
    const normalized = eventId.trim();
    if (!normalized) return LIVE_EVENT_PREFIX;
    return isLiveEventWatchId(normalized) ? normalized : `${LIVE_EVENT_PREFIX}${normalized}`;
}

export function toLiveEventSourceId(routeId: string): string {
    return isLiveEventWatchId(routeId) ? routeId.slice(LIVE_EVENT_PREFIX.length) : routeId;
}
