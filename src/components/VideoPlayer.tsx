'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Channel } from '@/types/channel';

interface VideoPlayerProps {
    channel: Channel | null;
}

function buildProxyUrl(originalUrl: string, token?: string): string {
    const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/api/proxy?url=${encodeURIComponent(originalUrl)}${tokenParam}`;
}

type ShakaVariantTrack = {
    id?: number | string;
    height?: number;
    bandwidth?: number;
    audioOnly?: boolean;
    allowedByApplication?: boolean;
    allowedByKeySystem?: boolean;
};

type ShakaRequest = {
    uris: string[];
};

type ShakaNetworkingEngine = {
    registerRequestFilter: (filter: (_type: unknown, request: ShakaRequest) => void) => void;
};

type ShakaPlayer = {
    attach: (video: HTMLVideoElement) => Promise<void>;
    destroy: () => Promise<void>;
    addEventListener: (event: string, listener: (event: ShakaErrorEvent) => void) => void;
    getVariantTracks?: () => ShakaVariantTrack[];
    getNetworkingEngine?: () => ShakaNetworkingEngine | null;
    configure: (config: {
        streaming?: {
            bufferingGoal?: number;
            rebufferingGoal?: number;
            bufferBehind?: number;
        };
        abr?: {
            enabled?: boolean;
            switchInterval?: number;
        };
        drm?: {
            clearKeys?: Record<string, string>;
            preferredKeySystems?: string[];
            servers?: Record<string, string>;
        };
    }) => void;
    unload: () => Promise<void>;
    load: (url: string) => Promise<void>;
    selectVariantTrack: (track: ShakaVariantTrack, clearBuffer: boolean) => void;
};

type ShakaModule = {
    polyfill: {
        installAll: () => void;
    };
    log?: {
        Level?: {
            NONE?: number;
        };
        setLevel?: (level: number) => void;
    };
    Player: {
        new(): ShakaPlayer;
        isBrowserSupported: () => boolean;
    };
};

type MpegtsErrorInfo = {
    msg?: string;
};

type MpegtsPlayer = {
    pause: () => void;
    unload: () => void;
    detachMediaElement: () => void;
    destroy: () => void;
    attachMediaElement: (video: HTMLVideoElement) => void;
    load: () => void;
    on: (event: string, listener: (type: string, detail: string, info?: MpegtsErrorInfo) => void) => void;
};

type QualityOption = {
    value: string;
    label: string;
    trackId: number | null;
};

type ShakaErrorDetail = {
    message?: string;
    code?: number;
    handled?: boolean;
    severity?: number;
    category?: number;
};

type ShakaErrorEvent = {
    detail?: ShakaErrorDetail;
    preventDefault?: () => void;
};

type PlaybackResolveResponse = {
    channelId: string;
    streamUrl: string;
    shouldProxy: boolean;
    proxyToken: string | null;
    drm: {
        type: 'none' | 'widevine' | 'clearkey';
        licenseProxyUrl: string | null;
    };
};

type PrerollCheckResponse = {
    enabled: boolean;
    shouldShow: boolean;
    durationSeconds: number;
    mediaUrl: string;
    mediaType: 'video' | 'image';
    clickUrl: string;
};

type PrerollState = {
    mediaUrl: string;
    clickUrl: string;
    secondsLeft: number;
    isVideo: boolean;
};

const AUTO_QUALITY_VALUE = 'auto';
const QUALITY_CONTROL_HIDE_DELAY_MS = 3000;
const AUTO_RETRY_DELAY_MS = 1500;
const MAX_AUTO_RETRIES = 1;
const PREROLL_CHECK_TIMEOUT_MS = 2500;
const MANIFEST_PREFLIGHT_TIMEOUT_MS = 6000;

function isPlayableVariantTrack(track: ShakaVariantTrack): boolean {
    if (!track || typeof track !== 'object') return false;
    if (track.audioOnly === true) return false;
    if (track.allowedByApplication === false) return false;
    if (track.allowedByKeySystem === false) return false;
    return true;
}

function buildQualityLabel(track: ShakaVariantTrack): string {
    const height = Number(track?.height);
    const bandwidth = Number(track?.bandwidth);

    if (Number.isFinite(height) && height > 0) {
        return `${Math.round(height)}p`;
    }
    if (Number.isFinite(bandwidth) && bandwidth > 0) {
        return `${Math.round(bandwidth / 1000)} kbps`;
    }
    return 'Manual';
}

function getQualityOptions(tracks: ShakaVariantTrack[]): QualityOption[] {
    const playable = tracks
        .filter(isPlayableVariantTrack)
        .slice()
        .sort((a, b) => {
            const ah = Number(a?.height) || 0;
            const bh = Number(b?.height) || 0;
            if (ah !== bh) return bh - ah;
            const ab = Number(a?.bandwidth) || 0;
            const bb = Number(b?.bandwidth) || 0;
            return bb - ab;
        });

    const options: QualityOption[] = [
        { value: AUTO_QUALITY_VALUE, label: 'Auto', trackId: null },
    ];

    for (const track of playable) {
        const trackId = Number(track?.id);
        if (!Number.isFinite(trackId)) continue;

        options.push({
            value: `track-${trackId}`,
            label: buildQualityLabel(track),
            trackId,
        });
    }

    return options;
}

function formatShakaError(detail?: ShakaErrorDetail): string {
    const code = detail?.code;
    if (code === 4001) {
        return 'Manifest DASH tidak valid dari sumber stream (code: 4001)';
    }
    if (code === 4032) {
        const lowerMessage = String(detail?.message || '').toLowerCase();
        if (
            lowerMessage.includes('cloudfront') ||
            lowerMessage.includes('access denied') ||
            lowerMessage.includes('forbidden') ||
            lowerMessage.includes('country')
        ) {
            return 'Stream ditolak CloudFront (geo/IP restriction). Coba deploy lewat region yang diizinkan provider.';
        }
        return 'Manifest/segment stream ditolak provider (4032). Biasanya terkait URL expired, token salah, atau geo/IP block.';
    }
    if (code === 6006) {
        return 'DRM gagal membuat license request (code: 6006)';
    }
    if (code === 6012) {
        return 'DRM tidak menemukan license server untuk key system yang dipakai stream (code: 6012)';
    }

    const message = detail?.message || 'Gagal memuat stream';
    return `${message}${code ? ` (code: ${code})` : ''}`;
}

function isRetryablePlaybackFailure(message: string): boolean {
    const normalized = message.toLowerCase();

    if (
        normalized.includes('geo restriction') ||
        normalized.includes('cloudfront') ||
        normalized.includes('access from your country')
    ) {
        return false;
    }

    if (
        normalized.includes('networkerror') ||
        normalized.includes('failed to fetch') ||
        normalized.includes('proxy error') ||
        normalized.includes('ioexception') ||
        normalized.includes('bad http status')
    ) {
        return true;
    }

    return /(?:^|\D)(403|429|500|502|503|504)(?:\D|$)/.test(normalized);
}

function toFriendlyPlaybackError(message: string): string {
    if (isRetryablePlaybackFailure(message)) {
        return 'Sumber stream sedang gangguan dari provider. Coba lagi beberapa saat.';
    }
    return message;
}

function isVideoMedia(url: string): boolean {
    const lower = url.toLowerCase();
    return (
        /\.mp4(?:$|\?)/i.test(lower) ||
        /\.webm(?:$|\?)/i.test(lower) ||
        /\.ogg(?:$|\?)/i.test(lower)
    );
}

function isValidHttpUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

function extractProxyTargetUrl(proxiedUrl: string): string | null {
    try {
        const parsed = new URL(proxiedUrl, window.location.origin);
        if (!parsed.pathname.endsWith('/api/proxy')) return null;
        const target = parsed.searchParams.get('url');
        if (!target) return null;
        return target;
    } catch {
        return null;
    }
}

function getManifestTypeFromUrl(url: string): 'dash' | 'hls' | null {
    const normalized = url.toLowerCase();
    if (normalized.includes('.mpd')) return 'dash';
    if (normalized.includes('.m3u8')) return 'hls';
    return null;
}

function looksLikeCloudFrontBlock(bodySnippet: string): boolean {
    const lower = bodySnippet.toLowerCase();
    return (
        lower.includes('the amazon cloudfront distribution is configured to block access from your country') ||
        (lower.includes('cloudfront') && lower.includes('access denied')) ||
        (lower.includes('cloudfront') && lower.includes('forbidden'))
    );
}

function extractShakaCodeFromMessage(message: string): number | null {
    const match = message.match(/(?:shaka error|code)\s*:?\s*(\d{3,5})/i);
    if (!match) return null;
    const code = Number(match[1]);
    return Number.isFinite(code) ? code : null;
}

function extractShakaErrorDetail(reason: unknown): ShakaErrorDetail | null {
    if (!reason) return null;

    if (typeof reason === 'string') {
        const code = extractShakaCodeFromMessage(reason);
        if (!code) return null;
        return {
            code,
            message: reason,
        };
    }

    const root = reason as {
        detail?: unknown;
    };
    if (root.detail && typeof root.detail === 'object') {
        return extractShakaErrorDetail(root.detail);
    }

    const candidate = reason as {
        code?: unknown;
        message?: unknown;
        severity?: unknown;
        category?: unknown;
    };

    const code = Number(candidate.code);
    const message = typeof candidate.message === 'string' ? candidate.message : '';
    const fallbackCode = !Number.isFinite(code) ? extractShakaCodeFromMessage(message) : null;
    const hasShakaSignature =
        message.toLowerCase().includes('shaka error') ||
        Number.isFinite(Number(candidate.severity)) ||
        Number.isFinite(Number(candidate.category));

    const finalCode = Number.isFinite(code) ? code : fallbackCode;
    if (!Number.isFinite(finalCode) || !hasShakaSignature) return null;
    const normalizedCode = Number(finalCode);

    return {
        code: normalizedCode,
        message: message || `Shaka Error ${normalizedCode}`,
        severity: Number(candidate.severity),
        category: Number(candidate.category),
    };
}

export default function VideoPlayer({ channel }: VideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const prerollVideoRef = useRef<HTMLVideoElement>(null);
    const playerRef = useRef<ShakaPlayer>(null);
    const mpegtsPlayerRef = useRef<MpegtsPlayer | null>(null); // mpegts.js player instance
    const proxyTokenRef = useRef<string | null>(null);
    const autoRetryCountRef = useRef(0);
    const autoRetryTimerRef = useRef<number | null>(null);
    const prerollTimerRef = useRef<number | null>(null);
    const prerollSleepResolveRef = useRef<(() => void) | null>(null);
    const skipPrerollRef = useRef(false);
    const shouldProxyRef = useRef(false);
    const requestSeqRef = useRef(0);
    const initSeqRef = useRef(0);
    const qualityHideTimerRef = useRef<number | null>(null);
    const isPlayingRef = useRef(false);
    const [playerReady, setPlayerReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [qualityOptions, setQualityOptions] = useState<QualityOption[]>([
        { value: AUTO_QUALITY_VALUE, label: 'Auto', trackId: null },
    ]);
    const [selectedQuality, setSelectedQuality] = useState(AUTO_QUALITY_VALUE);
    const [showQualityControl, setShowQualityControl] = useState(false);
    const [reloadTick, setReloadTick] = useState(0);
    const [prerollState, setPrerollState] = useState<PrerollState | null>(null);
    const activeChannelId = channel?.id ?? null;

    const clearQualityHideTimer = useCallback(() => {
        if (qualityHideTimerRef.current !== null) {
            window.clearTimeout(qualityHideTimerRef.current);
            qualityHideTimerRef.current = null;
        }
    }, []);

    const clearAutoRetryTimer = useCallback(() => {
        if (autoRetryTimerRef.current !== null) {
            window.clearTimeout(autoRetryTimerRef.current);
            autoRetryTimerRef.current = null;
        }
    }, []);

    const clearPrerollTimer = useCallback(() => {
        if (prerollTimerRef.current !== null) {
            window.clearTimeout(prerollTimerRef.current);
            prerollTimerRef.current = null;
        }
        if (prerollSleepResolveRef.current) {
            const resolveSleep = prerollSleepResolveRef.current;
            prerollSleepResolveRef.current = null;
            resolveSleep();
        }
    }, []);

    const queueAutoRetry = useCallback((errorMessage: string): boolean => {
        if (!activeChannelId) return false;
        if (!isRetryablePlaybackFailure(errorMessage)) return false;
        if (autoRetryCountRef.current >= MAX_AUTO_RETRIES) return false;

        autoRetryCountRef.current += 1;
        clearAutoRetryTimer();
        setError('Sumber stream sedang gangguan dari provider. Mencoba ulang otomatis...');
        setLoading(true);
        autoRetryTimerRef.current = window.setTimeout(() => {
            setReloadTick((value) => value + 1);
        }, AUTO_RETRY_DELAY_MS);
        return true;
    }, [activeChannelId, clearAutoRetryTimer]);

    const handlePlaybackFailure = useCallback((message: string) => {
        skipPrerollRef.current = true;
        setPrerollState(null);
        clearPrerollTimer();
        if (queueAutoRetry(message)) {
            return;
        }
        setError(toFriendlyPlaybackError(message));
        setLoading(false);
    }, [clearPrerollTimer, queueAutoRetry]);

    const handleManualRetry = useCallback(() => {
        if (!activeChannelId) return;
        clearAutoRetryTimer();
        autoRetryCountRef.current = 0;
        skipPrerollRef.current = false;
        setPrerollState(null);
        clearPrerollTimer();
        setError(null);
        setLoading(true);
        setReloadTick((value) => value + 1);
    }, [activeChannelId, clearAutoRetryTimer, clearPrerollTimer]);

    const sleepWithPrerollTimer = useCallback(async (ms: number) => {
        await new Promise<void>((resolve) => {
            prerollSleepResolveRef.current = () => {
                prerollSleepResolveRef.current = null;
                resolve();
            };
            prerollTimerRef.current = window.setTimeout(() => {
                prerollTimerRef.current = null;
                const resolveSleep = prerollSleepResolveRef.current;
                prerollSleepResolveRef.current = null;
                resolveSleep?.();
            }, ms);
        });
    }, []);

    const maybePlayPreroll = useCallback(async (requestId: number, cancelled: () => boolean) => {
        skipPrerollRef.current = false;
        let showedPreroll = false;
        try {
            const controller = new AbortController();
            const timeoutId = window.setTimeout(() => controller.abort(), PREROLL_CHECK_TIMEOUT_MS);

            let checkResponse: Response;
            try {
                checkResponse = await fetch('/api/v1/preroll/check', {
                    cache: 'no-store',
                    signal: controller.signal,
                });
            } finally {
                window.clearTimeout(timeoutId);
            }

            if (!checkResponse.ok) return;

            const payload = (await checkResponse.json()) as PrerollCheckResponse;
            const mediaUrl = String(payload.mediaUrl || '').trim();
            if (!payload.shouldShow || !mediaUrl) return;
            if (!isValidHttpUrl(mediaUrl)) return;

            const duration = Math.max(1, Math.min(30, Math.round(Number(payload.durationSeconds) || 5)));
            const clickUrl = String(payload.clickUrl || '').trim();
            const isVideo = payload.mediaType
                ? payload.mediaType === 'video'
                : isVideoMedia(mediaUrl);

            showedPreroll = true;
            setLoading(false);

            for (let seconds = duration; seconds > 0; seconds -= 1) {
                if (cancelled() || requestSeqRef.current !== requestId || skipPrerollRef.current) {
                    break;
                }

                setPrerollState({
                    mediaUrl,
                    clickUrl,
                    secondsLeft: seconds,
                    isVideo,
                });
                await sleepWithPrerollTimer(1000);
            }
        } catch {
            // Ignore preroll failure to keep main playback stable.
        } finally {
            skipPrerollRef.current = false;
            setPrerollState(null);
            clearPrerollTimer();
            if (showedPreroll) setLoading(true);
        }
    }, [clearPrerollTimer, sleepWithPrerollTimer]);

    const preflightProxiedManifest = useCallback(async (
        streamUrl: string,
        drmType: 'none' | 'widevine' | 'clearkey'
    ) => {
        const targetUrl = extractProxyTargetUrl(streamUrl);
        if (!targetUrl) return;

        const manifestType = getManifestTypeFromUrl(targetUrl);
        if (!manifestType) return;

        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), MANIFEST_PREFLIGHT_TIMEOUT_MS);
        try {
            const response = await fetch(streamUrl, {
                cache: 'no-store',
                signal: controller.signal,
                headers: {
                    Accept: 'application/dash+xml,application/vnd.apple.mpegurl,text/plain,*/*',
                },
            });

            const body = await response.text().catch(() => '');
            const snippet = body.slice(0, 4000);
            const lowerSnippet = snippet.toLowerCase();

            if (!response.ok) {
                if (looksLikeCloudFrontBlock(snippet)) {
                    throw new Error('Stream ditolak CloudFront untuk IP/region saat ini (geo restriction).');
                }
                throw new Error(`Provider menolak manifest stream (${response.status}).`);
            }

            if (looksLikeCloudFrontBlock(snippet)) {
                throw new Error('Stream ditolak CloudFront untuk IP/region saat ini (geo restriction).');
            }

            if (lowerSnippet.includes('<html') && !lowerSnippet.includes('<mpd') && !lowerSnippet.includes('#extm3u')) {
                throw new Error('Manifest tidak valid: server mengembalikan HTML, bukan playlist stream.');
            }

            if (manifestType === 'dash' && !lowerSnippet.includes('<mpd')) {
                throw new Error('Manifest DASH tidak valid dari sumber stream.');
            }
            if (manifestType === 'hls' && !lowerSnippet.includes('#extm3u')) {
                throw new Error('Manifest HLS tidak valid dari sumber stream.');
            }

            if (manifestType === 'dash') {
                const hasWidevineSignal =
                    lowerSnippet.includes('edef8ba9-79d6-4ace-a3c8-27dcd51d21ed') ||
                    lowerSnippet.includes('value="widevine"') ||
                    lowerSnippet.includes('widevine');
                if (hasWidevineSignal && drmType === 'none') {
                    throw new Error('Manifest butuh Widevine DRM, tapi channel belum punya konfigurasi license.');
                }
            }
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') {
                throw new Error('Timeout saat memeriksa manifest stream.');
            }
            throw error;
        } finally {
            window.clearTimeout(timeoutId);
        }
    }, []);

    const scheduleQualityAutoHide = useCallback(() => {
        clearQualityHideTimer();
        if (!activeChannelId || !isPlayingRef.current) return;

        qualityHideTimerRef.current = window.setTimeout(() => {
            setShowQualityControl(false);
            qualityHideTimerRef.current = null;
        }, QUALITY_CONTROL_HIDE_DELAY_MS);
    }, [activeChannelId, clearQualityHideTimer]);

    const revealQualityControl = useCallback(() => {
        if (!activeChannelId) return;
        setShowQualityControl(true);
        scheduleQualityAutoHide();
    }, [activeChannelId, scheduleQualityAutoHide]);

    const hideQualityControlOnLeave = useCallback(() => {
        if (!activeChannelId || !isPlayingRef.current) return;
        clearQualityHideTimer();
        setShowQualityControl(false);
    }, [activeChannelId, clearQualityHideTimer]);

    const refreshQualityOptions = useCallback(() => {
        const player = playerRef.current;
        if (!player) {
            setQualityOptions([{ value: AUTO_QUALITY_VALUE, label: 'Auto', trackId: null }]);
            setSelectedQuality(AUTO_QUALITY_VALUE);
            return;
        }

        const tracks = (player.getVariantTracks?.() || []) as ShakaVariantTrack[];
        const options = getQualityOptions(tracks);
        setQualityOptions(options);
        setSelectedQuality((prev) => (
            options.some((option) => option.value === prev)
                ? prev
                : AUTO_QUALITY_VALUE
        ));
    }, []);

    const handleQualityChange = useCallback((value: string) => {
        const player = playerRef.current;
        if (!player) return;

        setSelectedQuality(value);
        scheduleQualityAutoHide();

        if (value === AUTO_QUALITY_VALUE) {
            player.configure({ abr: { enabled: true } });
            return;
        }

        const selectedOption = qualityOptions.find((option) => option.value === value);
        if (!selectedOption || selectedOption.trackId === null) {
            player.configure({ abr: { enabled: true } });
            setSelectedQuality(AUTO_QUALITY_VALUE);
            return;
        }

        const tracks = (player.getVariantTracks?.() || []) as ShakaVariantTrack[];
        const target = tracks.find((track) => Number(track?.id) === selectedOption.trackId);
        if (!target) {
            player.configure({ abr: { enabled: true } });
            setSelectedQuality(AUTO_QUALITY_VALUE);
            return;
        }

        player.configure({ abr: { enabled: false } });
        player.selectVariantTrack(target, true);
    }, [qualityOptions, scheduleQualityAutoHide]);

    useEffect(() => {
        let destroyed = false;
        const initId = ++initSeqRef.current;

        async function initPlayerOnce() {
            try {
                const video = videoRef.current;
                if (!video) return;

                const shaka = (await import('shaka-player')) as unknown as ShakaModule;
                shaka.polyfill.installAll();
                shaka.log?.setLevel?.(shaka.log?.Level?.NONE ?? 0);
                if (destroyed || initSeqRef.current !== initId) return;

                if (!shaka.Player.isBrowserSupported()) {
                    setError('Browser tidak mendukung Shaka Player');
                    setLoading(false);
                    return;
                }

                const player = new shaka.Player();
                if (video) {
                    await player.attach(video);
                }
                if (destroyed || initSeqRef.current !== initId) {
                    await player.destroy().catch(() => { });
                    return;
                }
                playerRef.current = player;

                player.addEventListener('error', (event: ShakaErrorEvent) => {
                    if (destroyed) return;
                    if (event.detail) {
                        event.detail.handled = true;
                    }
                    event.preventDefault?.();
                    handlePlaybackFailure(formatShakaError(event.detail));
                });

                const syncQuality = () => {
                    if (!destroyed) refreshQualityOptions();
                };
                player.addEventListener('trackschanged', syncQuality);
                player.addEventListener('variantchanged', syncQuality);
                player.addEventListener('adaptation', syncQuality);

                const networkingEngine = player.getNetworkingEngine?.();
                if (networkingEngine) {
                    networkingEngine.registerRequestFilter(
                        (_type: unknown, request: { uris: string[] }) => {
                            if (!shouldProxyRef.current) return;

                            const url = request.uris?.[0];
                            if (!url || !url.startsWith('http')) return;
                            if (url.includes('/api/proxy')) return;
                            if (url.startsWith(window.location.origin)) return;

                            request.uris[0] = buildProxyUrl(url, proxyTokenRef.current || undefined);
                        }
                    );
                }

                player.configure({
                    streaming: {
                        bufferingGoal: 45,
                        rebufferingGoal: 15,
                        bufferBehind: 30,
                    },
                    abr: {
                        switchInterval: 10,
                    }
                });

                if (!destroyed && initSeqRef.current === initId) setPlayerReady(true);
            } catch (err: unknown) {
                if (destroyed || initSeqRef.current !== initId) return;
                const e = err as ShakaErrorDetail;
                setError(formatShakaError(e));
                setLoading(false);
            }
        }

        initPlayerOnce();

        return () => {
            destroyed = true;
            skipPrerollRef.current = true;
            initSeqRef.current += 1;
            requestSeqRef.current += 1;
            clearAutoRetryTimer();
            clearPrerollTimer();
            setPrerollState(null);
            setPlayerReady(false);
            setQualityOptions([{ value: AUTO_QUALITY_VALUE, label: 'Auto', trackId: null }]);
            setSelectedQuality(AUTO_QUALITY_VALUE);

            const player = playerRef.current;
            playerRef.current = null;

            if (player) {
                player.destroy().catch(() => { });
            }

            const mpegtsPlayer = mpegtsPlayerRef.current;
            mpegtsPlayerRef.current = null;
            if (mpegtsPlayer) {
                mpegtsPlayer.pause();
                mpegtsPlayer.unload();
                mpegtsPlayer.detachMediaElement();
                mpegtsPlayer.destroy();
            }
        };
    }, [clearAutoRetryTimer, clearPrerollTimer, handlePlaybackFailure, refreshQualityOptions]);

    useEffect(() => {
        if (!playerReady || !playerRef.current) return;

        const requestId = ++requestSeqRef.current;
        let cancelled = false;

        async function loadChannel() {
            const player = playerRef.current;
            if (!player) return;

            setError(null);

            if (!channel) {
                skipPrerollRef.current = true;
                clearAutoRetryTimer();
                clearPrerollTimer();
                autoRetryCountRef.current = 0;
                setPrerollState(null);
                shouldProxyRef.current = false;
                proxyTokenRef.current = null;
                setLoading(false);
                setQualityOptions([{ value: AUTO_QUALITY_VALUE, label: 'Auto', trackId: null }]);
                setSelectedQuality(AUTO_QUALITY_VALUE);
                await player.unload().catch(() => { });
                return;
            }

            setLoading(true);

            try {
                skipPrerollRef.current = false;
                shouldProxyRef.current = false;
                proxyTokenRef.current = null;

                await maybePlayPreroll(requestId, () => cancelled);
                if (cancelled || requestSeqRef.current !== requestId) return;

                const refreshParam = autoRetryCountRef.current > 0 ? `&refresh=${Date.now()}` : '';
                const resolveResponse = await fetch(`/api/v1/playback/resolve?id=${encodeURIComponent(channel.id)}${refreshParam}`, {
                    cache: 'no-store',
                });
                if (!resolveResponse.ok) {
                    const reasonText = await resolveResponse.text().catch(() => '');
                    let reason = reasonText.trim();
                    if (reasonText.trim().startsWith('{')) {
                        try {
                            const parsed = JSON.parse(reasonText) as { error?: unknown };
                            if (typeof parsed.error === 'string' && parsed.error.trim()) {
                                reason = parsed.error.trim();
                            }
                        } catch {
                            // Keep plain text reason.
                        }
                    }
                    if (reason) {
                        throw new Error(reason);
                    }
                    throw new Error(`Gagal resolve playback (${resolveResponse.status})`);
                }

                const playback = (await resolveResponse.json()) as PlaybackResolveResponse;
                shouldProxyRef.current = Boolean(playback.shouldProxy);
                proxyTokenRef.current = playback.proxyToken;

                player.configure({
                    drm: {
                        clearKeys: {},
                        preferredKeySystems: [],
                        servers: {},
                    },
                });

                if (playback.drm.type === 'clearkey' && playback.drm.licenseProxyUrl) {
                    const clearKeyResponse = await fetch(playback.drm.licenseProxyUrl, {
                        cache: 'no-store',
                    });
                    if (!clearKeyResponse.ok) {
                        throw new Error(`Gagal mengambil data clearkey: ${clearKeyResponse.status}`);
                    }

                    const clearKeyPayload = (await clearKeyResponse.json()) as {
                        keys?: Array<{ kid?: string; k?: string; kty?: string }>;
                    };
                    const clearKeys: Record<string, string> = {};
                    for (const item of clearKeyPayload.keys || []) {
                        const kid = String(item?.kid || '').trim();
                        const key = String(item?.k || '').trim();
                        if (!kid || !key) continue;
                        clearKeys[kid] = key;
                    }

                    if (Object.keys(clearKeys).length === 0) {
                        throw new Error('Data clearkey kosong atau tidak valid');
                    }

                    player.configure({
                        drm: {
                            clearKeys,
                            preferredKeySystems: ['org.w3.clearkey'],
                            servers: {},
                        },
                    });
                }

                if (playback.drm.type === 'widevine' && playback.drm.licenseProxyUrl) {
                    player.configure({
                        drm: {
                            preferredKeySystems: ['com.widevine.alpha'],
                            servers: {
                                'com.widevine.alpha': playback.drm.licenseProxyUrl,
                            },
                        },
                    });
                }

                const streamUrl = playback.streamUrl;
                const isFlv = streamUrl.toLowerCase().split('?')[0].endsWith('.flv') ||
                    (streamUrl.includes('/api/proxy') && streamUrl.toLowerCase().includes('.flv'));

                // Cleanup existing players before loading new ones
                await player.unload().catch(() => { });
                if (mpegtsPlayerRef.current) {
                    mpegtsPlayerRef.current.pause();
                    mpegtsPlayerRef.current.unload();
                    mpegtsPlayerRef.current.detachMediaElement();
                    mpegtsPlayerRef.current.destroy();
                    mpegtsPlayerRef.current = null;
                }

                if (cancelled || requestSeqRef.current !== requestId) return;

                if (isFlv) {
                    if (videoRef.current) {
                        try {
                            const mpegts = (await import('mpegts.js')).default;
                            if (cancelled || requestSeqRef.current !== requestId) return;

                            let flvUrl = streamUrl;
                            if (flvUrl.startsWith('/')) {
                                flvUrl = window.location.origin + flvUrl;
                            }

                            const mpegtsPlayer = mpegts.createPlayer({
                                type: 'flv',
                                isLive: true,
                                url: flvUrl,
                            }, {
                                enableWorker: true,
                                enableStashBuffer: true,
                                stashInitialSize: 512,
                                liveBufferLatencyChasing: true,
                                liveBufferLatencyMaxLatency: 3.0,
                                seekType: 'range',
                            });

                            mpegtsPlayer.attachMediaElement(videoRef.current);
                            mpegtsPlayer.load();
                            mpegtsPlayerRef.current = mpegtsPlayer;

                            mpegtsPlayer.on(mpegts.Events.ERROR, (type: string, detail: string, info?: MpegtsErrorInfo) => {
                                console.error('mpegts error:', type, detail, info);
                                handlePlaybackFailure(`FLV Error: ${String(detail || '')} ${info?.msg || ''}`);
                            });

                            if (!cancelled && requestSeqRef.current === requestId) {
                                autoRetryCountRef.current = 0;
                                setLoading(false);
                                videoRef.current?.play().catch(() => { });
                            }
                        } catch (flvErr) {
                            console.error('Failed to load mpegts.js', flvErr);
                            setError('Browser tidak mendukung FLV playback');
                            setLoading(false);
                        }
                    } else {
                        setLoading(false);
                    }
                } else {
                    if (shouldProxyRef.current) {
                        await preflightProxiedManifest(streamUrl, playback.drm.type);
                        if (cancelled || requestSeqRef.current !== requestId) return;
                    }

                    await player.load(streamUrl);
                    refreshQualityOptions();
                    setSelectedQuality(AUTO_QUALITY_VALUE);

                    if (!cancelled && requestSeqRef.current === requestId) {
                        autoRetryCountRef.current = 0;
                        setLoading(false);
                        videoRef.current?.play().catch(() => { });
                    }
                }
            } catch (err: unknown) {
                if (cancelled || requestSeqRef.current !== requestId) return;
                const e = err as ShakaErrorDetail;
                handlePlaybackFailure(formatShakaError(e));
            }
        }

        loadChannel();

        return () => {
            cancelled = true;
            skipPrerollRef.current = true;
            clearPrerollTimer();
            setPrerollState(null);
        };
    }, [channel, clearAutoRetryTimer, clearPrerollTimer, handlePlaybackFailure, maybePlayPreroll, playerReady, preflightProxiedManifest, refreshQualityOptions, reloadTick]);

    useEffect(() => {
        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            const detail = extractShakaErrorDetail(event.reason);
            if (!detail) return;

            event.preventDefault();
            handlePlaybackFailure(formatShakaError(detail));
        };

        const handleWindowError = (event: ErrorEvent) => {
            const detail = extractShakaErrorDetail(event.error ?? event.message);
            if (!detail) return;

            event.preventDefault();
            handlePlaybackFailure(formatShakaError(detail));
        };

        window.addEventListener('unhandledrejection', handleUnhandledRejection);
        window.addEventListener('error', handleWindowError);
        return () => {
            window.removeEventListener('unhandledrejection', handleUnhandledRejection);
            window.removeEventListener('error', handleWindowError);
        };
    }, [handlePlaybackFailure]);

    useEffect(() => {
        clearQualityHideTimer();
        clearAutoRetryTimer();
        clearPrerollTimer();
        skipPrerollRef.current = true;
        autoRetryCountRef.current = 0;
        setPrerollState(null);
        if (!activeChannelId) {
            isPlayingRef.current = false;
            setShowQualityControl(false);
            return;
        }

        isPlayingRef.current = false;
        skipPrerollRef.current = false;
        setShowQualityControl(true);

        return () => {
            clearQualityHideTimer();
            clearAutoRetryTimer();
            clearPrerollTimer();
            skipPrerollRef.current = true;
            setPrerollState(null);
            isPlayingRef.current = false;
        };
    }, [activeChannelId, clearAutoRetryTimer, clearPrerollTimer, clearQualityHideTimer]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handlePlay = () => {
            isPlayingRef.current = true;
            revealQualityControl();
        };

        const handlePauseLike = () => {
            isPlayingRef.current = false;
            clearQualityHideTimer();
            setShowQualityControl(Boolean(activeChannelId));
        };

        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePauseLike);
        video.addEventListener('ended', handlePauseLike);

        return () => {
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePauseLike);
            video.removeEventListener('ended', handlePauseLike);
        };
    }, [activeChannelId, clearQualityHideTimer, revealQualityControl]);

    useEffect(() => {
        if (!prerollState?.isVideo) return;
        prerollVideoRef.current?.play().catch(() => { });
    }, [prerollState]);

    return (
        <div
            className="w-full aspect-video bg-black rounded-xl overflow-hidden relative"
            onMouseMove={revealQualityControl}
            onMouseEnter={revealQualityControl}
            onMouseLeave={hideQualityControlOnLeave}
            onTouchStart={revealQualityControl}
        >
            {channel && (
                <div
                    className={`absolute top-2 right-2 z-30 flex items-center gap-2 rounded-lg bg-black/60 px-2 py-1.5 backdrop-blur transition-opacity duration-200 ${showQualityControl ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                >
                    <label className="text-[11px] text-gray-200">Resolusi</label>
                    <select
                        value={selectedQuality}
                        onChange={(e) => handleQualityChange(e.target.value)}
                        onFocus={revealQualityControl}
                        onBlur={scheduleQualityAutoHide}
                        disabled={qualityOptions.length <= 1}
                        className="bg-black/40 border border-white/20 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-400"
                    >
                        {qualityOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>
            )}
            {!channel && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
                    <div className="text-center text-gray-500">
                        <div className="text-3xl mb-3">TV</div>
                        <p className="text-lg font-medium">Pilih channel untuk mulai menonton</p>
                    </div>
                </div>
            )}
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-white text-sm">Memuat stream...</p>
                    </div>
                </div>
            )}
            {prerollState && (
                <div className="absolute inset-0 z-40 bg-black">
                    {prerollState.isVideo ? (
                        <video
                            ref={prerollVideoRef}
                            src={prerollState.mediaUrl}
                            className="w-full h-full object-cover"
                            autoPlay
                            muted
                            playsInline
                            onError={() => {
                                skipPrerollRef.current = true;
                            }}
                        />
                    ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={prerollState.mediaUrl}
                            alt="Sponsored"
                            className="w-full h-full object-cover"
                            onError={() => {
                                skipPrerollRef.current = true;
                            }}
                        />
                    )}

                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-4">
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-xs text-gray-200">
                                Iklan berakhir dalam {prerollState.secondsLeft} detik
                            </p>
                            {prerollState.clickUrl && (
                                <a
                                    href={prerollState.clickUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center rounded-md bg-white/15 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/25 transition-colors"
                                >
                                    Kunjungi Sponsor
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
                    <div className="text-center px-6">
                        <div className="text-3xl mb-3">Warning</div>
                        <p className="text-red-400 font-semibold mb-1">Gagal memuat stream</p>
                        <p className="text-gray-400 text-sm max-w-md">{error}</p>
                        {channel && (
                            <button
                                type="button"
                                onClick={handleManualRetry}
                                className="mt-4 inline-flex items-center rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 transition-colors"
                            >
                                Coba lagi
                            </button>
                        )}
                    </div>
                </div>
            )}
            <video
                ref={videoRef}
                className="w-full h-full"
                controls={Boolean(channel)}
                autoPlay={Boolean(channel)}
                playsInline
            />
        </div>
    );
}
