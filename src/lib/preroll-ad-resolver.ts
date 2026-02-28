type ResolvedPrerollAd = {
    mediaUrl: string;
    mediaType: 'video' | 'image';
    clickUrl: string;
};

const FETCH_TIMEOUT_MS = 5000;

function extractFirstMatch(input: string, pattern: RegExp): string {
    const match = input.match(pattern);
    if (!match) return '';
    return String(match[1] ?? '').trim();
}

function stripCdata(value: string): string {
    return value
        .replace(/^<!\[CDATA\[/i, '')
        .replace(/\]\]>$/i, '')
        .trim();
}

function decodeXmlEntities(value: string): string {
    return value
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

function normalizeExtractedUrl(value: string): string {
    const stripped = stripCdata(value);
    const decoded = decodeXmlEntities(stripped);
    return decoded.trim();
}

function isHttpUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

function looksLikeDirectMedia(url: string): boolean {
    return (
        /\.(mp4|webm|ogg|m3u8|mpd|jpg|jpeg|png|gif|webp)(?:$|\?)/i.test(url)
    );
}

function looksLikeVast(text: string): boolean {
    const normalized = text.toLowerCase();
    return normalized.includes('<vast') || normalized.includes('<mediafile');
}

function parseVast(xml: string): ResolvedPrerollAd | null {
    // Prefer MP4/WebM/Ogg media file.
    const mediaRegex = /<MediaFile\b([^>]*)>([\s\S]*?)<\/MediaFile>/gi;
    let bestUrl = '';
    let bestType = '';

    let match = mediaRegex.exec(xml);
    while (match) {
        const attrs = String(match[1] ?? '');
        const rawValue = String(match[2] ?? '');
        const mediaUrl = normalizeExtractedUrl(rawValue);
        const typeAttr = extractFirstMatch(attrs, /type=["']([^"']+)["']/i).toLowerCase();

        if (!isHttpUrl(mediaUrl)) {
            match = mediaRegex.exec(xml);
            continue;
        }

        if (!bestUrl) {
            bestUrl = mediaUrl;
            bestType = typeAttr;
        }

        if (typeAttr.includes('mp4') || typeAttr.includes('webm') || typeAttr.includes('ogg')) {
            bestUrl = mediaUrl;
            bestType = typeAttr;
            break;
        }

        match = mediaRegex.exec(xml);
    }

    if (!bestUrl) return null;

    const clickRaw = extractFirstMatch(xml, /<ClickThrough\b[^>]*>([\s\S]*?)<\/ClickThrough>/i);
    const clickUrl = normalizeExtractedUrl(clickRaw);
    const mediaType: 'video' | 'image' = bestType.startsWith('image/') ? 'image' : 'video';

    return {
        mediaUrl: bestUrl,
        mediaType,
        clickUrl: isHttpUrl(clickUrl) ? clickUrl : '',
    };
}

export async function resolvePrerollAd(inputUrl: string): Promise<ResolvedPrerollAd | null> {
    const url = inputUrl.trim();
    if (!isHttpUrl(url)) return null;

    if (looksLikeDirectMedia(url)) {
        const mediaType: 'video' | 'image' = /\.(jpg|jpeg|png|gif|webp)(?:$|\?)/i.test(url) ? 'image' : 'video';
        return {
            mediaUrl: url,
            mediaType,
            clickUrl: '',
        };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const response = await fetch(url, {
            cache: 'no-store',
            signal: controller.signal,
            headers: {
                Accept: 'application/xml,text/xml,*/*',
            },
        });
        if (!response.ok) return null;

        const text = await response.text();
        if (!looksLikeVast(text)) return null;
        return parseVast(text);
    } catch {
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
}
