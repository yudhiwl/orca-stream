'use client';

import { useState, useEffect, useCallback } from 'react';
import { Channel } from '@/types/channel';
import { LiveEvent } from '@/types/live-event';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
    Plus, Pencil, Trash2, ChevronLeft, Tv2,
    Check, X, Save, AlertTriangle, Radio, Settings
} from 'lucide-react';

const JENIS_OPTIONS = [
    'dash-clearkey', 'hls', 'dash', 'mp4', 'hls-clearkey'
];

const CATEGORY_OPTIONS = [
    'General', 'Sports', 'News', 'Entertainment', 'Kids', 'Movie', 'Music', 'Documentary'
];

const SPORT_OPTIONS = [
    'Sepak Bola', 'Bulu Tangkis', 'Formula 1', 'Basket', 'Tenis', 'Voli', 'MMA', 'Lainnya'
];

const CHANNELS_PER_PAGE = 20;

const EMPTY_LIVE_EVENT: LiveEvent = {
    id: '',
    title: '',
    sport: '',
    category: 'Events',
    competition: '',
    hls: '',
    jenis: 'hls',
    header_iptv: '',
    header_license: '',
    url_license: '',
    thumbnail: '',
    is_live: 'f',
    t_stamp: 'none',
    s_stamp: 'none',
};

const EMPTY_FORM: Channel = {
    id: '',
    name: '',
    tagline: '',
    hls: '',
    namespace: '',
    is_live: 'f',
    is_movie: 'f',
    subtitle: '',
    image: '',
    jenis: 'dash-clearkey',
    premium: 'f',
    alpha_2_code: 'ID',
    country_name: 'Indonesia',
    t_stamp: 'none',
    s_stamp: 'none',
    url_license: '',
    fake_event: 'f',
    header_iptv: '',
    header_license: '',
    category: 'General',
};

type FormData = Channel;
type AdminPlayerSettings = {
    playbackEnabled: boolean;
    playbackEnabledWeb: boolean;
    playbackEnabledMobile: boolean;
    prerollEnabled: boolean;
    prerollMode: 'test' | 'production';
    prerollDurationSeconds: number;
    prerollMediaUrl: string;
    prerollClickUrl: string;
    rightSidebarAdEnabled: boolean;
    rightSidebarAdType: 'image' | 'iframe' | 'script';
    rightSidebarAdImageUrl: string;
    rightSidebarAdIframeUrl: string;
    rightSidebarAdScript: string;
    rightSidebarAdClickUrl: string;
    rightSidebarAdAltText: string;
    topPlayerAdEnabled: boolean;
    topPlayerAdType: 'image' | 'iframe' | 'script';
    topPlayerAdImageUrl: string;
    topPlayerAdIframeUrl: string;
    topPlayerAdScript: string;
    topPlayerAdClickUrl: string;
    topPlayerAdAltText: string;
    topPlayerMobileFallbackEnabled: boolean;
    topPlayerMobileFallbackType: 'image' | 'iframe' | 'script';
    topPlayerMobileFallbackImageUrl: string;
    topPlayerMobileFallbackIframeUrl: string;
    topPlayerMobileFallbackScript: string;
    topPlayerMobileFallbackClickUrl: string;
    topPlayerMobileFallbackAltText: string;
    updatedAt: string;
};

type AdminSessionPayload = {
    authenticated?: boolean;
};

function formatEventSchedule(tStamp: string): string {
    const stamp = Number(tStamp);
    if (!Number.isFinite(stamp) || tStamp === 'none') return '-';

    return new Date(stamp * 1000).toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function inferSportType(title: string, competition: string): string {
    const text = `${title} ${competition}`.toLowerCase();
    if (text.includes('futsal')) return 'Futsal';
    if (text.includes('badminton') || text.includes('bulu tangkis')) return 'Bulu Tangkis';
    if (text.includes('formula 1') || text.includes('f1')) return 'Formula 1';
    if (text.includes('basket') || text.includes('nba')) return 'Basket';
    if (text.includes('tenis') || text.includes('tennis')) return 'Tenis';
    if (text.includes('voli') || text.includes('volley')) return 'Voli';
    if (text.includes('mma') || text.includes('ufc')) return 'MMA';
    return 'Sepak Bola';
}

function collectApiErrorMessages(errorPayload: unknown): string[] {
    if (!errorPayload) return [];

    if (typeof errorPayload === 'string') {
        return errorPayload.trim() ? [errorPayload.trim()] : [];
    }

    if (Array.isArray(errorPayload)) {
        return errorPayload
            .filter((v): v is string => typeof v === 'string')
            .map(v => v.trim())
            .filter(Boolean);
    }

    if (typeof errorPayload !== 'object') return [];

    const obj = errorPayload as Record<string, unknown>;
    const messages: string[] = [];

    if (typeof obj.message === 'string' && obj.message.trim()) {
        messages.push(obj.message.trim());
    }

    const formErrors = obj.formErrors;
    if (Array.isArray(formErrors)) {
        for (const item of formErrors) {
            if (typeof item === 'string' && item.trim()) {
                messages.push(item.trim());
            }
        }
    }

    const fieldErrors = obj.fieldErrors;
    if (fieldErrors && typeof fieldErrors === 'object') {
        for (const [field, value] of Object.entries(fieldErrors as Record<string, unknown>)) {
            if (Array.isArray(value)) {
                for (const item of value) {
                    if (typeof item === 'string' && item.trim()) {
                        messages.push(`${field}: ${item.trim()}`);
                    }
                }
            } else if (typeof value === 'string' && value.trim()) {
                messages.push(`${field}: ${value.trim()}`);
            }
        }
    }

    return Array.from(new Set(messages));
}

async function getApiErrorMessage(res: Response, fallback: string): Promise<string> {
    try {
        const data = await res.clone().json();
        const rootMessages = collectApiErrorMessages(data);
        if (rootMessages.length > 0) return rootMessages.join(' | ');

        if (data && typeof data === 'object' && 'error' in (data as Record<string, unknown>)) {
            const errorMessages = collectApiErrorMessages((data as Record<string, unknown>).error);
            if (errorMessages.length > 0) return errorMessages.join(' | ');
        }
    } catch {
        // ignore JSON parse errors and fallback to plain text below
    }

    try {
        const text = (await res.text()).trim();
        if (text) return text;
    } catch {
        // ignore text read errors
    }

    return `${fallback} (HTTP ${res.status})`;
}

export default function AdminPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'channels' | 'live-events' | 'settings'>('channels');
    const [authReady, setAuthReady] = useState(false);

    // --- Channel state ---
    const [channels, setChannels] = useState<Channel[]>([]);
    const [channelPage, setChannelPage] = useState(1);
    const [form, setForm] = useState<FormData>(EMPTY_FORM);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    // --- Live Events state ---
    const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
    const [leForm, setLeForm] = useState<LiveEvent>(EMPTY_LIVE_EVENT);
    const [leEditingId, setLeEditingId] = useState<string | null>(null);
    const [leShowForm, setLeShowForm] = useState(false);
    const [leLoading, setLeLoading] = useState(false);
    const [leDeleteId, setLeDeleteId] = useState<string | null>(null);
    const [showLeAdvanced, setShowLeAdvanced] = useState(false);
    const [playerSettings, setPlayerSettings] = useState<AdminPlayerSettings>({
        playbackEnabled: true,
        playbackEnabledWeb: true,
        playbackEnabledMobile: true,
        prerollEnabled: false,
        prerollMode: 'test',
        prerollDurationSeconds: 5,
        prerollMediaUrl: '',
        prerollClickUrl: '',
        rightSidebarAdEnabled: false,
        rightSidebarAdType: 'image',
        rightSidebarAdImageUrl: '',
        rightSidebarAdIframeUrl: '',
        rightSidebarAdScript: '',
        rightSidebarAdClickUrl: '',
        rightSidebarAdAltText: 'Sponsored',
        topPlayerAdEnabled: false,
        topPlayerAdType: 'image',
        topPlayerAdImageUrl: '',
        topPlayerAdIframeUrl: '',
        topPlayerAdScript: '',
        topPlayerAdClickUrl: '',
        topPlayerAdAltText: 'Sponsored',
        topPlayerMobileFallbackEnabled: false,
        topPlayerMobileFallbackType: 'image',
        topPlayerMobileFallbackImageUrl: '',
        topPlayerMobileFallbackIframeUrl: '',
        topPlayerMobileFallbackScript: '',
        topPlayerMobileFallbackClickUrl: '',
        topPlayerMobileFallbackAltText: 'Sponsored',
        updatedAt: '',
    });
    const [settingsLoading, setSettingsLoading] = useState(true);
    const [settingsSaving, setSettingsSaving] = useState(false);

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const redirectToLogin = useCallback(() => {
        router.replace('/admin/login');
    }, [router]);

    const fetchChannels = useCallback(async () => {
        const res = await fetch('/api/channels?includeSecrets=true', { cache: 'no-store' });
        if (res.status === 401) {
            redirectToLogin();
            return;
        }
        const data = await res.json();
        setChannels(Array.isArray(data) ? data : []);
    }, [redirectToLogin]);

    const fetchLiveEvents = useCallback(async () => {
        const res = await fetch('/api/v1/live-events?includeSecrets=true', { cache: 'no-store' });
        if (res.status === 401) {
            redirectToLogin();
            return;
        }
        const data = await res.json();
        setLiveEvents(Array.isArray(data) ? data : []);
    }, [redirectToLogin]);

    const fetchPlayerSettings = useCallback(async () => {
        setSettingsLoading(true);
        try {
            const res = await fetch('/api/admin/player-settings', { cache: 'no-store' });
            if (res.status === 401) {
                redirectToLogin();
                return;
            }
            const data = (await res.json()) as Partial<AdminPlayerSettings>;
            const legacyPlaybackEnabled = data.playbackEnabled !== false;
            const playbackEnabledWeb =
                typeof data.playbackEnabledWeb === 'boolean'
                    ? data.playbackEnabledWeb
                    : legacyPlaybackEnabled;
            const playbackEnabledMobile =
                typeof data.playbackEnabledMobile === 'boolean'
                    ? data.playbackEnabledMobile
                    : legacyPlaybackEnabled;
            setPlayerSettings({
                playbackEnabled: playbackEnabledWeb,
                playbackEnabledWeb,
                playbackEnabledMobile,
                prerollEnabled: data.prerollEnabled === true,
                prerollMode: data.prerollMode === 'production' ? 'production' : 'test',
                prerollDurationSeconds: Math.max(1, Math.min(30, Math.round(Number(data.prerollDurationSeconds) || 5))),
                prerollMediaUrl: String(data.prerollMediaUrl ?? ''),
                prerollClickUrl: String(data.prerollClickUrl ?? ''),
                rightSidebarAdEnabled: data.rightSidebarAdEnabled === true,
                rightSidebarAdType:
                    data.rightSidebarAdType === 'iframe' || data.rightSidebarAdType === 'script'
                        ? data.rightSidebarAdType
                        : 'image',
                rightSidebarAdImageUrl: String(data.rightSidebarAdImageUrl ?? ''),
                rightSidebarAdIframeUrl: String(data.rightSidebarAdIframeUrl ?? ''),
                rightSidebarAdScript: String(data.rightSidebarAdScript ?? ''),
                rightSidebarAdClickUrl: String(data.rightSidebarAdClickUrl ?? ''),
                rightSidebarAdAltText: String(data.rightSidebarAdAltText ?? 'Sponsored') || 'Sponsored',
                topPlayerAdEnabled: data.topPlayerAdEnabled === true,
                topPlayerAdType:
                    data.topPlayerAdType === 'iframe' || data.topPlayerAdType === 'script'
                        ? data.topPlayerAdType
                        : 'image',
                topPlayerAdImageUrl: String(data.topPlayerAdImageUrl ?? ''),
                topPlayerAdIframeUrl: String(data.topPlayerAdIframeUrl ?? ''),
                topPlayerAdScript: String(data.topPlayerAdScript ?? ''),
                topPlayerAdClickUrl: String(data.topPlayerAdClickUrl ?? ''),
                topPlayerAdAltText: String(data.topPlayerAdAltText ?? 'Sponsored') || 'Sponsored',
                topPlayerMobileFallbackEnabled: data.topPlayerMobileFallbackEnabled === true,
                topPlayerMobileFallbackType:
                    data.topPlayerMobileFallbackType === 'iframe' || data.topPlayerMobileFallbackType === 'script'
                        ? data.topPlayerMobileFallbackType
                        : 'image',
                topPlayerMobileFallbackImageUrl: String(data.topPlayerMobileFallbackImageUrl ?? ''),
                topPlayerMobileFallbackIframeUrl: String(data.topPlayerMobileFallbackIframeUrl ?? ''),
                topPlayerMobileFallbackScript: String(data.topPlayerMobileFallbackScript ?? ''),
                topPlayerMobileFallbackClickUrl: String(data.topPlayerMobileFallbackClickUrl ?? ''),
                topPlayerMobileFallbackAltText: String(data.topPlayerMobileFallbackAltText ?? 'Sponsored') || 'Sponsored',
                updatedAt: String(data.updatedAt ?? ''),
            });
        } catch {
            setToast({ msg: 'Gagal memuat player settings', type: 'error' });
            setTimeout(() => setToast(null), 3000);
        } finally {
            setSettingsLoading(false);
        }
    }, [redirectToLogin]);

    useEffect(() => {
        let mounted = true;

        (async () => {
            try {
                const sessionRes = await fetch('/api/admin/auth/session', { cache: 'no-store' });
                if (!sessionRes.ok) {
                    redirectToLogin();
                    return;
                }

                const session = (await sessionRes.json()) as AdminSessionPayload;
                if (!session.authenticated) {
                    redirectToLogin();
                    return;
                }

                if (!mounted) return;
                setAuthReady(true);
                await Promise.all([
                    fetchChannels(),
                    fetchLiveEvents(),
                    fetchPlayerSettings(),
                ]);
            } catch {
                redirectToLogin();
            }
        })();

        return () => {
            mounted = false;
        };
    }, [fetchChannels, fetchLiveEvents, fetchPlayerSettings, redirectToLogin]);

    const totalChannelPages = Math.max(1, Math.ceil(channels.length / CHANNELS_PER_PAGE));
    const currentChannelPage = Math.min(channelPage, totalChannelPages);
    const channelStartIndex = (currentChannelPage - 1) * CHANNELS_PER_PAGE;
    const channelEndIndex = Math.min(channelStartIndex + CHANNELS_PER_PAGE, channels.length);
    const pagedChannels = channels.slice(channelStartIndex, channelEndIndex);

    useEffect(() => {
        if (channelPage > totalChannelPages) {
            setChannelPage(totalChannelPages);
        }
    }, [channelPage, totalChannelPages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name || (!editingId && !form.hls)) {
            showToast('Nama dan URL Stream wajib diisi', 'error');
            return;
        }
        setLoading(true);
        try {
            const payload: Record<string, unknown> = {
                id: form.id || undefined,
                name: form.name,
                tagline: form.tagline,
                hls: form.hls,
                namespace: form.namespace || form.name,
                is_live: form.is_live,
                is_movie: form.is_movie,
                subtitle: form.subtitle,
                image: form.image,
                jenis: form.jenis,
                premium: form.premium,
                alpha_2_code: form.alpha_2_code,
                country_name: form.country_name,
                t_stamp: form.t_stamp,
                s_stamp: form.s_stamp,
                ...(editingId ? {} : { hls: form.hls }),
                fake_event: form.fake_event,
                category: form.category || 'General',
            };
            if (editingId && form.hls.trim()) payload.hls = form.hls;
            if (!editingId || form.url_license.trim()) payload.url_license = form.url_license;
            if (!editingId || form.header_iptv.trim()) payload.header_iptv = form.header_iptv;
            if (!editingId || form.header_license.trim()) payload.header_license = form.header_license;

            if (editingId) {
                const res = await fetch(`/api/channels/${editingId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) {
                    throw new Error(await getApiErrorMessage(res, 'Gagal update channel'));
                }
                showToast('Channel berhasil diupdate');
            } else {
                const res = await fetch('/api/channels', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) {
                    throw new Error(await getApiErrorMessage(res, 'Gagal menambah channel'));
                }
                showToast('Channel berhasil ditambahkan');
            }
            await fetchChannels();
            setChannelPage(1);
            setForm(EMPTY_FORM);
            setEditingId(null);
            setShowForm(false);
        } catch (error: unknown) {
            const message = error instanceof Error && error.message
                ? error.message
                : 'Terjadi kesalahan';
            showToast(message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (channel: Channel) => {
        setForm({ ...channel });
        setEditingId(channel.id);
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/channels/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                throw new Error(await getApiErrorMessage(res, 'Gagal menghapus channel'));
            }
            await fetchChannels();
            showToast('Channel berhasil dihapus');
        } catch (error: unknown) {
            const message = error instanceof Error && error.message
                ? error.message
                : 'Gagal menghapus channel';
            showToast(message, 'error');
        } finally {
            setDeleteId(null);
        }
    };

    // ---- Live Events handlers ----
    const leHandleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!leForm.title || (!leEditingId && !leForm.hls)) {
            showToast('Tagline dan URL Stream wajib diisi', 'error');
            return;
        }
        setLeLoading(true);
        try {
            const payload: Record<string, unknown> = {
                id: leForm.id || undefined,
                tagline: leForm.title,
                name: leForm.competition,
                namespace: leForm.competition,
                image: leForm.thumbnail,
                ...(leEditingId ? {} : { hls: leForm.hls }),
                jenis: leForm.jenis,
                is_live: leForm.is_live,
                t_stamp: leForm.t_stamp,
                s_stamp: leForm.s_stamp,
                sport: leForm.sport?.trim() || inferSportType(leForm.title, leForm.competition),
                category: leForm.category?.trim() || 'Events',
            };
            if (leEditingId && leForm.hls.trim()) payload.hls = leForm.hls;
            if (!leEditingId || leForm.header_iptv.trim()) payload.header_iptv = leForm.header_iptv;
            if (!leEditingId || leForm.header_license.trim()) payload.header_license = leForm.header_license;
            if (!leEditingId || leForm.url_license.trim()) payload.url_license = leForm.url_license;

            if (leEditingId) {
                const res = await fetch(`/api/v1/live-events/${leEditingId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) {
                    throw new Error(await getApiErrorMessage(res, 'Gagal update event'));
                }
                showToast('Event berhasil diupdate');
            } else {
                const res = await fetch('/api/v1/live-events', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) {
                    throw new Error(await getApiErrorMessage(res, 'Gagal menambah event'));
                }
                showToast('Event berhasil ditambahkan');
            }
            await fetchLiveEvents();
            setLeForm(EMPTY_LIVE_EVENT);
            setLeEditingId(null);
            setLeShowForm(false);
        } catch (error: unknown) {
            const message = error instanceof Error && error.message
                ? error.message
                : 'Gagal menyimpan event';
            showToast(message, 'error');
        } finally {
            setLeLoading(false);
        }
    };

    const leHandleEdit = (event: LiveEvent) => {
        setLeForm({ ...event });
        setLeEditingId(event.id);
        setLeShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const leHandleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/v1/live-events/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                throw new Error(await getApiErrorMessage(res, 'Gagal menghapus event'));
            }
            await fetchLiveEvents();
            showToast('Event berhasil dihapus');
        } catch (error: unknown) {
            const message = error instanceof Error && error.message
                ? error.message
                : 'Gagal menghapus event';
            showToast(message, 'error');
        } finally {
            setLeDeleteId(null);
        }
    };

    // Toggle is_live directly without opening form
    const leToggleLive = async (event: LiveEvent) => {
        const newVal = event.is_live === 't' ? 'f' : 't';
        try {
            const res = await fetch(`/api/v1/live-events/${event.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_live: newVal }),
            });
            if (!res.ok) {
                throw new Error(await getApiErrorMessage(res, 'Gagal update status event'));
            }
            await fetchLiveEvents();
            showToast(newVal === 't' ? 'LIVE event ditayangkan' : 'Event disembunyikan');
        } catch (error: unknown) {
            const message = error instanceof Error && error.message
                ? error.message
                : 'Gagal update status event';
            showToast(message, 'error');
        }
    };

    const savePlayerSettings = async () => {
        setSettingsSaving(true);
        try {
            const res = await fetch('/api/admin/player-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playbackEnabled: playerSettings.playbackEnabledWeb,
                    playbackEnabledWeb: playerSettings.playbackEnabledWeb,
                    playbackEnabledMobile: playerSettings.playbackEnabledMobile,
                    prerollEnabled: playerSettings.prerollEnabled,
                    prerollMode: playerSettings.prerollMode,
                    prerollDurationSeconds: playerSettings.prerollDurationSeconds,
                    prerollMediaUrl: playerSettings.prerollMediaUrl,
                    prerollClickUrl: playerSettings.prerollClickUrl,
                    rightSidebarAdEnabled: playerSettings.rightSidebarAdEnabled,
                    rightSidebarAdType: playerSettings.rightSidebarAdType,
                    rightSidebarAdImageUrl: playerSettings.rightSidebarAdImageUrl,
                    rightSidebarAdIframeUrl: playerSettings.rightSidebarAdIframeUrl,
                    rightSidebarAdScript: playerSettings.rightSidebarAdScript,
                    rightSidebarAdClickUrl: playerSettings.rightSidebarAdClickUrl,
                    rightSidebarAdAltText: playerSettings.rightSidebarAdAltText,
                    topPlayerAdEnabled: playerSettings.topPlayerAdEnabled,
                    topPlayerAdType: playerSettings.topPlayerAdType,
                    topPlayerAdImageUrl: playerSettings.topPlayerAdImageUrl,
                    topPlayerAdIframeUrl: playerSettings.topPlayerAdIframeUrl,
                    topPlayerAdScript: playerSettings.topPlayerAdScript,
                    topPlayerAdClickUrl: playerSettings.topPlayerAdClickUrl,
                    topPlayerAdAltText: playerSettings.topPlayerAdAltText,
                    topPlayerMobileFallbackEnabled: playerSettings.topPlayerMobileFallbackEnabled,
                    topPlayerMobileFallbackType: playerSettings.topPlayerMobileFallbackType,
                    topPlayerMobileFallbackImageUrl: playerSettings.topPlayerMobileFallbackImageUrl,
                    topPlayerMobileFallbackIframeUrl: playerSettings.topPlayerMobileFallbackIframeUrl,
                    topPlayerMobileFallbackScript: playerSettings.topPlayerMobileFallbackScript,
                    topPlayerMobileFallbackClickUrl: playerSettings.topPlayerMobileFallbackClickUrl,
                    topPlayerMobileFallbackAltText: playerSettings.topPlayerMobileFallbackAltText,
                }),
            });
            if (!res.ok) {
                throw new Error(await getApiErrorMessage(res, 'Gagal menyimpan player settings'));
            }
            const data = (await res.json()) as Partial<AdminPlayerSettings>;
            const legacyPlaybackEnabled = data.playbackEnabled !== false;
            const playbackEnabledWeb =
                typeof data.playbackEnabledWeb === 'boolean'
                    ? data.playbackEnabledWeb
                    : legacyPlaybackEnabled;
            const playbackEnabledMobile =
                typeof data.playbackEnabledMobile === 'boolean'
                    ? data.playbackEnabledMobile
                    : legacyPlaybackEnabled;
            setPlayerSettings({
                playbackEnabled: playbackEnabledWeb,
                playbackEnabledWeb,
                playbackEnabledMobile,
                prerollEnabled: data.prerollEnabled === true,
                prerollMode: data.prerollMode === 'production' ? 'production' : 'test',
                prerollDurationSeconds: Math.max(1, Math.min(30, Math.round(Number(data.prerollDurationSeconds) || 5))),
                prerollMediaUrl: String(data.prerollMediaUrl ?? ''),
                prerollClickUrl: String(data.prerollClickUrl ?? ''),
                rightSidebarAdEnabled: data.rightSidebarAdEnabled === true,
                rightSidebarAdType:
                    data.rightSidebarAdType === 'iframe' || data.rightSidebarAdType === 'script'
                        ? data.rightSidebarAdType
                        : 'image',
                rightSidebarAdImageUrl: String(data.rightSidebarAdImageUrl ?? ''),
                rightSidebarAdIframeUrl: String(data.rightSidebarAdIframeUrl ?? ''),
                rightSidebarAdScript: String(data.rightSidebarAdScript ?? ''),
                rightSidebarAdClickUrl: String(data.rightSidebarAdClickUrl ?? ''),
                rightSidebarAdAltText: String(data.rightSidebarAdAltText ?? 'Sponsored') || 'Sponsored',
                topPlayerAdEnabled: data.topPlayerAdEnabled === true,
                topPlayerAdType:
                    data.topPlayerAdType === 'iframe' || data.topPlayerAdType === 'script'
                        ? data.topPlayerAdType
                        : 'image',
                topPlayerAdImageUrl: String(data.topPlayerAdImageUrl ?? ''),
                topPlayerAdIframeUrl: String(data.topPlayerAdIframeUrl ?? ''),
                topPlayerAdScript: String(data.topPlayerAdScript ?? ''),
                topPlayerAdClickUrl: String(data.topPlayerAdClickUrl ?? ''),
                topPlayerAdAltText: String(data.topPlayerAdAltText ?? 'Sponsored') || 'Sponsored',
                topPlayerMobileFallbackEnabled: data.topPlayerMobileFallbackEnabled === true,
                topPlayerMobileFallbackType:
                    data.topPlayerMobileFallbackType === 'iframe' || data.topPlayerMobileFallbackType === 'script'
                        ? data.topPlayerMobileFallbackType
                        : 'image',
                topPlayerMobileFallbackImageUrl: String(data.topPlayerMobileFallbackImageUrl ?? ''),
                topPlayerMobileFallbackIframeUrl: String(data.topPlayerMobileFallbackIframeUrl ?? ''),
                topPlayerMobileFallbackScript: String(data.topPlayerMobileFallbackScript ?? ''),
                topPlayerMobileFallbackClickUrl: String(data.topPlayerMobileFallbackClickUrl ?? ''),
                topPlayerMobileFallbackAltText: String(data.topPlayerMobileFallbackAltText ?? 'Sponsored') || 'Sponsored',
                updatedAt: String(data.updatedAt ?? ''),
            });
            showToast(
                `Playback Web ${playbackEnabledWeb ? 'aktif' : 'nonaktif'} | Mobile ${playbackEnabledMobile ? 'aktif' : 'nonaktif'}`
            );
        } catch (error: unknown) {
            const message = error instanceof Error && error.message
                ? error.message
                : 'Gagal menyimpan player settings';
            showToast(message, 'error');
        } finally {
            setSettingsSaving(false);
        }
    };

    const field = (key: keyof FormData, label: string, props?: React.InputHTMLAttributes<HTMLInputElement>) => (
        <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</label>
            <input
                {...props}
                value={(form[key] as string) || ''}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
        </div>
    );

    const toggle = (key: keyof FormData, label: string) => (
        <button
            type="button"
            onClick={() => setForm(f => ({ ...f, [key]: f[key] === 't' ? 'f' : 't' }))}
            className="flex items-center gap-2 py-2 px-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition-colors"
        >
            {/* Switch track */}
            <div className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${form[key] === 't' ? 'bg-indigo-600' : 'bg-white/10'
                }`}>
                <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-transform ${form[key] === 't' ? 'translate-x-[18px]' : 'translate-x-0.5'
                    }`} />
            </div>
            {/* Label */}
            <span className={`text-sm whitespace-nowrap ${form[key] === 't' ? 'text-white' : 'text-gray-400'
                }`}>{label}</span>
        </button>
    );

    if (!authReady) {
        return (
            <div className="min-h-screen bg-[#080a0f] text-white flex items-center justify-center">
                <p className="text-sm text-gray-400">Memeriksa sesi admin...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#080a0f] text-white">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-medium transition-all ${toast.type === 'success'
                    ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                    : 'bg-red-500/20 border border-red-500/30 text-red-400'
                    }`}>
                    {toast.type === 'success' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    {toast.msg}
                </div>
            )}

            {/* Confirm Delete Modal */}
            {(deleteId || leDeleteId) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-[#13151e] border border-white/10 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                                <Trash2 className="w-5 h-5 text-red-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">
                                    {leDeleteId ? 'Hapus Live Event?' : 'Hapus Channel?'}
                                </h3>
                                <p className="text-sm text-gray-400">Tindakan ini tidak bisa dibatalkan</p>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                            <button
                                onClick={() => {
                                    setDeleteId(null);
                                    setLeDeleteId(null);
                                }}
                                className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg py-2 text-sm font-medium transition-colors"
                            >
                                Batal
                            </button>
                            <button
                                onClick={() => {
                                    if (leDeleteId) {
                                        leHandleDelete(leDeleteId);
                                    } else if (deleteId && deleteId !== 'live-event-trigger') {
                                        handleDelete(deleteId);
                                    }
                                    setDeleteId(null);
                                }}
                                className="flex-1 bg-red-600 hover:bg-red-700 rounded-lg py-2 text-sm font-medium transition-colors"
                            >
                                Hapus
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="sticky top-0 z-40 border-b border-white/5 bg-[#080a0f]/90 backdrop-blur-md">
                <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-4">
                    <Link href="/" className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors">
                        <ChevronLeft className="w-4 h-4" />
                        <span className="text-sm">Back</span>
                    </Link>
                    <div className="flex items-center gap-2 ml-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                            <Tv2 className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="font-bold">Admin Panel</span>
                    </div>

                    <nav className="hidden sm:flex items-center gap-4 ml-4 px-4 border-l border-white/10 text-sm font-medium">
                        <Link href="/" className="text-gray-400 hover:text-white transition-colors">TV Channels</Link>
                        <Link href="/live-sports" className="text-gray-400 hover:text-white transition-colors flex items-center gap-1.5">
                            Live Sports
                        </Link>
                    </nav>

                    {/* Tab navigation */}
                    <div className="flex items-center gap-1 ml-4">
                        <button
                            onClick={() => setActiveTab('channels')}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm transition-colors ${activeTab === 'channels'
                                ? 'bg-white/10 text-white'
                                : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            <Tv2 className="w-3.5 h-3.5" />
                            Channel
                        </button>
                        <button
                            onClick={() => setActiveTab('live-events')}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm transition-colors ${activeTab === 'live-events'
                                ? 'bg-white/10 text-white'
                                : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            <Radio className="w-3.5 h-3.5" />
                            Live Sports
                            {liveEvents.filter(e => e.is_live === 't').length > 0 && (
                                <span className="bg-red-500/20 text-red-400 text-[10px] px-1.5 py-0.5 rounded-full">
                                    {liveEvents.filter(e => e.is_live === 't').length}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('settings')}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm transition-colors ${activeTab === 'settings'
                                ? 'bg-white/10 text-white'
                                : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            <Settings className="w-3.5 h-3.5" />
                            Settings
                        </button>
                    </div>

                    <div className="ml-auto">
                        {activeTab === 'channels' ? (
                            <button
                                onClick={() => { setForm(EMPTY_FORM); setEditingId(null); setShowForm(s => !s); }}
                                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                            >
                                {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                {showForm ? 'Tutup' : 'Add Channel'}
                            </button>
                        ) : activeTab === 'live-events' ? (
                            <button
                                onClick={() => { setLeForm(EMPTY_LIVE_EVENT); setLeEditingId(null); setLeShowForm(s => !s); }}
                                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                            >
                                {leShowForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                {leShowForm ? 'Tutup' : 'Add Event'}
                            </button>
                        ) : (
                            <button
                                onClick={savePlayerSettings}
                                disabled={settingsLoading || settingsSaving}
                                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-700/40 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                            >
                                {settingsSaving ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                Simpan Setting
                            </button>
                        )}
                    </div>
                </div>
            </header>

            <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
                {/* Add/Edit Form */}
                {/* Channels View */}
                {activeTab === 'channels' && (
                    <div className="space-y-6">
                        {/* Add/Edit Form */}
                        {showForm && (
                            <div className="bg-[#0f1117] border border-white/5 rounded-2xl overflow-hidden">
                                <div className="border-b border-white/5 px-6 py-4">
                                    <h2 className="font-semibold text-white">
                                        {editingId ? 'Edit Channel' : 'Tambah Channel Baru'}
                                    </h2>
                                </div>
                                <form onSubmit={handleSubmit} className="p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                        {/* Basic Info */}
                                        <div className="space-y-3">
                                            <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2">Info Dasar</h3>
                                            {/* ID Field */}
                                            {editingId ? (
                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">ID Channel (source: id)</label>
                                                    <div className="flex items-center gap-2 bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2">
                                                        <span className="text-xs font-mono text-indigo-400">{form.id}</span>
                                                        <span className="text-[10px] text-gray-600 ml-auto">tidak dapat diubah</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">ID Channel (source: id) <span className="text-gray-600 normal-case">(kosongkan = auto)</span></label>
                                                    <input
                                                        type="text"
                                                        value={form.id || ''}
                                                        onChange={e => setForm(f => ({ ...f, id: e.target.value }))}
                                                        placeholder="e.g. 172"
                                                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                                                    />
                                                </div>
                                            )}
                                            {field('name', 'Nama Channel (name) *', { placeholder: 'e.g. RCTI' })}
                                            {field('namespace', 'Namespace (namespace)', { placeholder: 'e.g. RCTI' })}
                                            {field('tagline', 'Tagline (tagline)', { placeholder: 'e.g. Kebanggaan bersama milik bangsa' })}
                                            {field('subtitle', 'Subtitle (subtitle)', { placeholder: 'opsional' })}
                                            {field('image', 'URL Gambar (image)', { placeholder: 'https://...' })}
                                            {field('alpha_2_code', 'Kode Negara (source: alpha_2_code)', { placeholder: 'ID' })}
                                            {field('country_name', 'Nama Negara (source: country_name)', { placeholder: 'Indonesia' })}
                                        </div>

                                        {/* Stream Config */}
                                        <div className="space-y-3">
                                            <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2">Konfigurasi Stream</h3>
                                            {field('hls', 'URL Stream (hls) *', { placeholder: 'https://...index.mpd atau index.m3u8' })}

                                            {/* Jenis Stream */}
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Jenis Stream (jenis)</label>
                                                <select
                                                    value={form.jenis}
                                                    onChange={e => setForm(f => ({ ...f, jenis: e.target.value }))}
                                                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                                >
                                                    {JENIS_OPTIONS.map(j => <option key={j} value={j} className="bg-gray-900">{j}</option>)}
                                                </select>
                                            </div>

                                            {/* Category */}
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Kategori (internal)</label>
                                                <select
                                                    value={form.category || 'General'}
                                                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                                                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                                >
                                                    {CATEGORY_OPTIONS.map(c => <option key={c} value={c} className="bg-gray-900">{c}</option>)}
                                                </select>
                                            </div>

                                            {field('url_license', 'License URL (source: url_license)', { placeholder: 'eyJrZXlzIjpb...' })}
                                            {field('t_stamp', 'T-Stamp (source: t_stamp)', { placeholder: 'none atau timestamp' })}
                                            {field('s_stamp', 'S-Stamp (source: s_stamp)', { placeholder: 'none atau timestamp' })}
                                        </div>
                                    </div>

                                    {/* Headers */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Header IPTV (source: header_iptv)</label>
                                            <textarea
                                                value={form.header_iptv || ''}
                                                onChange={e => setForm(f => ({ ...f, header_iptv: e.target.value }))}
                                                rows={3}
                                                placeholder='{"Referer":"https://...","Origin":"https://..."}'
                                                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 font-mono resize-none"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Header License (source: header_license)</label>
                                            <textarea
                                                value={form.header_license || ''}
                                                onChange={e => setForm(f => ({ ...f, header_license: e.target.value }))}
                                                rows={3}
                                                placeholder='{"x-data":"none"}'
                                                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 font-mono resize-none"
                                            />
                                        </div>
                                    </div>

                                    {/* Toggles */}
                                    <div className="flex flex-wrap gap-2 border-t border-white/5 pt-4 mb-6">
                                        {toggle('is_live', 'Live')}
                                        {toggle('is_movie', 'Movie')}
                                        {toggle('premium', 'Premium')}
                                        {toggle('fake_event', 'Fake Event')}
                                    </div>

                                    {/* Submit */}
                                    <div className="flex gap-3 justify-end">
                                        <button
                                            type="button"
                                            onClick={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); }}
                                            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium transition-colors"
                                        >
                                            Batal
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-600/50 rounded-lg text-sm font-medium transition-colors"
                                        >
                                            {loading ? (
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                <Save className="w-4 h-4" />
                                            )}
                                            {editingId ? 'Update Channel' : 'Simpan Channel'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* Channel Table */}
                        <div className="bg-[#0f1117] border border-white/5 rounded-2xl overflow-hidden">
                            <div className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
                                <h2 className="font-semibold text-white">
                                    Daftar Channel <span className="text-gray-500 font-normal text-sm ml-1">({channels.length})</span>
                                </h2>
                            </div>

                            {channels.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-gray-600">
                                    <Tv2 className="w-12 h-12 mb-4 opacity-30" />
                                    <p className="font-medium">Belum ada channel</p>
                                    <p className="text-sm mt-1 opacity-70">Klik &quot;Add Channel&quot; untuk menambahkan</p>
                                </div>
                            ) : (
                                <>
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-white/5">
                                                    <th className="text-left px-6 py-3">Channel</th>
                                                    <th className="text-left px-4 py-3">Jenis</th>
                                                    <th className="text-left px-4 py-3">Kategori</th>
                                                    <th className="text-left px-4 py-3">Status</th>
                                                    <th className="text-right px-6 py-3">Aksi</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/[0.04]">
                                                {pagedChannels.map(channel => (
                                                    <tr key={channel.id} className="hover:bg-white/[0.02] transition-colors group">
                                                        <td className="px-6 py-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-9 h-9 rounded-lg bg-white/10 flex-shrink-0 overflow-hidden flex items-center justify-center">
                                                                    {channel.image ? (
                                                                        <Image src={channel.image} alt={channel.name} width={36} height={36} className="object-contain" unoptimized />
                                                                    ) : (
                                                                        <Tv2 className="w-4 h-4 text-gray-500" />
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-medium text-white">{channel.name}</p>
                                                                    <p className="text-xs text-gray-500">{channel.namespace} · {channel.country_name}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                                                                {channel.jenis}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className="text-xs text-gray-400">{channel.category || 'General'}</span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                {channel.is_live === 't' && (
                                                                    <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full">LIVE</span>
                                                                )}
                                                                {channel.premium === 't' && (
                                                                    <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full">PREMIUM</span>
                                                                )}
                                                                {channel.is_live !== 't' && channel.premium !== 't' && (
                                                                    <span className="text-[10px] text-gray-600">—</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-3">
                                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button
                                                                    onClick={() => handleEdit(channel)}
                                                                    className="p-1.5 rounded-lg bg-white/5 hover:bg-indigo-500/20 hover:text-indigo-400 transition-colors"
                                                                    title="Edit"
                                                                >
                                                                    <Pencil className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button
                                                                    onClick={() => setDeleteId(channel.id)}
                                                                    className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                                                                    title="Hapus"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="border-t border-white/5 px-6 py-3 flex items-center justify-between gap-3">
                                        <p className="text-xs text-gray-500">
                                            Menampilkan {channelStartIndex + 1}-{channelEndIndex} dari {channels.length}
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setChannelPage(p => Math.max(1, p - 1))}
                                                disabled={currentChannelPage <= 1}
                                                className="px-3 py-1.5 rounded-md text-xs border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                            >
                                                Prev
                                            </button>
                                            <span className="text-xs text-gray-400 min-w-[64px] text-center">
                                                {currentChannelPage} / {totalChannelPages}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setChannelPage(p => Math.min(totalChannelPages, p + 1))}
                                                disabled={currentChannelPage >= totalChannelPages}
                                                className="px-3 py-1.5 rounded-md text-xs border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Live Events View */}
                {activeTab === 'live-events' && (
                    <div className="space-y-6">
                        {/* Add/Edit Form */}
                        {leShowForm && (
                            <div className="bg-[#0f1117] border border-white/5 rounded-2xl overflow-hidden">
                                <div className="border-b border-white/5 px-6 py-4">
                                    <h2 className="font-semibold text-white flex items-center gap-2">
                                        <Radio className="w-4 h-4 text-red-400" />
                                        {leEditingId ? 'Edit Event' : 'Tambah Event Baru'}
                                    </h2>
                                </div>
                                <form onSubmit={leHandleSubmit} className="p-6">
                                    <div className="space-y-6">
                                        {/* Basic Info */}
                                        <div className="space-y-4">
                                            <h3 className="text-sm font-semibold text-white/90 border-b border-white/10 pb-2">Informasi Utama</h3>

                                            <div className="grid grid-cols-1 gap-4">
                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-xs font-medium text-gray-400">Tagline (source: tagline) *</label>
                                                    <input
                                                        required
                                                        value={leForm.title}
                                                        onChange={e => setLeForm(f => ({ ...f, title: e.target.value }))}
                                                        placeholder="e.g. 25 Feb 20:30 WIB - Team A vs Team B"
                                                        className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                                                    />
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="flex flex-col gap-1.5">
                                                        <label className="text-xs font-medium text-gray-400">Nama Event/Channel (source: name)</label>
                                                        <input
                                                            value={leForm.competition}
                                                            onChange={e => setLeForm(f => ({ ...f, competition: e.target.value }))}
                                                            placeholder="e.g. UEFA Champions League [CH8]"
                                                            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                                                        />
                                                    </div>

                                                    <div className="flex flex-col gap-1.5">
                                                        <label className="text-xs font-medium text-gray-400">Kategori Olahraga (auto-detect)</label>
                                                        <div className="bg-white/[0.03] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-300">
                                                            {inferSportType(leForm.title, leForm.competition)}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-xs font-medium text-gray-400">URL Stream (M3U8 / MPD) *</label>
                                                    <input
                                                        required
                                                        value={leForm.hls}
                                                        onChange={e => setLeForm(f => ({ ...f, hls: e.target.value }))}
                                                        placeholder="https://example.com/stream/index.m3u8"
                                                        className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                                                    />
                                                </div>

                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-xs font-medium text-gray-400">URL Gambar (source: image)</label>
                                                    <input
                                                        value={leForm.thumbnail}
                                                        onChange={e => setLeForm(f => ({ ...f, thumbnail: e.target.value }))}
                                                        placeholder="https://example.com/image.jpg"
                                                        className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Pengaturan Lanjutan */}
                                        <div className="border border-white/10 rounded-xl overflow-hidden bg-white/[0.01]">
                                            <button
                                                type="button"
                                                onClick={() => setShowLeAdvanced(!showLeAdvanced)}
                                                className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Settings className="w-4 h-4 text-indigo-400" />
                                                    <span className="text-sm font-medium text-white/80">Pengaturan Lanjutan (Opsional)</span>
                                                </div>
                                                <div className={`transform transition-transform ${showLeAdvanced ? 'rotate-180' : ''}`}>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="m6 9 6 6 6-6" /></svg>
                                                </div>
                                            </button>

                                            {showLeAdvanced && (
                                                <div className="p-4 space-y-4 border-t border-white/5">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {leEditingId ? (
                                                            <div className="flex flex-col gap-1.5">
                                                                <label className="text-xs font-medium text-gray-400">ID Event (source: id)</label>
                                                                <div className="flex items-center gap-2 bg-white/[0.03] border border-white/10 rounded-lg px-4 py-2.5">
                                                                    <span className="text-sm font-mono text-indigo-400">{leForm.id}</span>
                                                                    <span className="text-[10px] text-gray-500 ml-auto bg-black/20 px-2 py-0.5 rounded">AUTO-GENERATED</span>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col gap-1.5">
                                                                <label className="text-xs font-medium text-gray-400">ID Event (source: id)</label>
                                                                <input
                                                                    type="text"
                                                                    value={leForm.id || ''}
                                                                    onChange={e => setLeForm(f => ({ ...f, id: e.target.value }))}
                                                                    placeholder="Dibiarkan kosong = Auto Generate"
                                                                    className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 font-mono transition-all"
                                                                />
                                                            </div>
                                                        )}

                                                        <div className="flex flex-col gap-1.5">
                                                            <label className="text-xs font-medium text-gray-400">Jenis Streaming (source: jenis)</label>
                                                            <select
                                                                value={leForm.jenis}
                                                                onChange={e => setLeForm(f => ({ ...f, jenis: e.target.value }))}
                                                                className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all cursor-pointer"
                                                            >
                                                                {JENIS_OPTIONS.map(j => <option key={j} value={j} className="bg-gray-900">{j}</option>)}
                                                            </select>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col gap-1.5">
                                                        <label className="text-xs font-medium text-gray-400">Kategori Olahraga (override internal, opsional)</label>
                                                        <select
                                                            value={leForm.sport || ''}
                                                            onChange={e => setLeForm(f => ({ ...f, sport: e.target.value }))}
                                                            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all cursor-pointer"
                                                        >
                                                            <option value="" className="bg-gray-900">Auto (dari name/tagline)</option>
                                                            {SPORT_OPTIONS.map(s => <option key={s} value={s} className="bg-gray-900">{s}</option>)}
                                                        </select>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="flex flex-col gap-1.5">
                                                            <label className="text-xs font-medium text-gray-400">Header IPTV (source: header_iptv)</label>
                                                            <textarea
                                                                value={leForm.header_iptv}
                                                                onChange={e => setLeForm(f => ({ ...f, header_iptv: e.target.value }))}
                                                                rows={3}
                                                                placeholder='{"Referer": "https://..."}'
                                                                className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-gray-300 font-mono resize-none focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                                                            />
                                                        </div>

                                                        <div className="flex flex-col gap-1.5">
                                                            <label className="text-xs font-medium text-gray-400">Header License / DRM (source: header_license)</label>
                                                            <textarea
                                                                value={leForm.header_license}
                                                                onChange={e => setLeForm(f => ({ ...f, header_license: e.target.value }))}
                                                                rows={3}
                                                                placeholder='{"User-Agent": "..."}'
                                                                className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-gray-300 font-mono resize-none focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col gap-1.5">
                                                        <label className="text-xs font-medium text-gray-400">URL DRM License (source: url_license)</label>
                                                        <input
                                                            value={leForm.url_license}
                                                            onChange={e => setLeForm(f => ({ ...f, url_license: e.target.value }))}
                                                            placeholder="https://license.server.com/acquire"
                                                            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 font-mono transition-all"
                                                        />
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="flex flex-col gap-1.5">
                                                            <label className="text-xs font-medium text-gray-400">T-Stamp (source: t_stamp)</label>
                                                            <input
                                                                value={leForm.t_stamp}
                                                                onChange={e => setLeForm(f => ({ ...f, t_stamp: e.target.value }))}
                                                                placeholder="none atau timestamp"
                                                                className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 font-mono transition-all"
                                                            />
                                                        </div>
                                                        <div className="flex flex-col gap-1.5">
                                                            <label className="text-xs font-medium text-gray-400">S-Stamp (source: s_stamp)</label>
                                                            <input
                                                                value={leForm.s_stamp}
                                                                onChange={e => setLeForm(f => ({ ...f, s_stamp: e.target.value }))}
                                                                placeholder="none atau timestamp"
                                                                className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 font-mono transition-all"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Submit Actions */}
                                        <div className="flex gap-3 justify-end pt-2">
                                            <button
                                                type="button"
                                                onClick={() => { setLeShowForm(false); setLeEditingId(null); setLeForm(EMPTY_LIVE_EVENT); }}
                                                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium transition-all"
                                            >
                                                Batal & Tutup
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={leLoading}
                                                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 rounded-lg text-sm font-medium transition-all shadow-lg shadow-indigo-500/20"
                                            >
                                                {leLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                                                {leEditingId ? 'Simpan Perubahan' : 'Publish Event'}
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* Live Events Table */}
                        <div className="bg-[#0f1117] border border-white/5 rounded-2xl overflow-hidden">
                            <div className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
                                <h2 className="font-semibold text-white">
                                    Daftar Live Events <span className="text-gray-500 font-normal text-sm ml-1">({liveEvents.length})</span>
                                </h2>
                            </div>

                            {liveEvents.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-gray-600">
                                    <Radio className="w-12 h-12 mb-4 opacity-30" />
                                    <p className="font-medium">Belum ada live event</p>
                                    <p className="text-sm mt-1 opacity-70">Klik &quot;Add Event&quot; untuk menambahkan</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-white/5">
                                                <th className="text-left px-6 py-3">Tagline / Name</th>
                                                <th className="text-left px-4 py-3">Sport (Internal)</th>
                                                <th className="text-left px-4 py-3">Jadwal</th>
                                                <th className="text-center px-4 py-3">Tampilkan?</th>
                                                <th className="text-right px-6 py-3">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/[0.04]">
                                            {liveEvents.map(event => (
                                                <tr key={event.id} className="hover:bg-white/[0.02] transition-colors group">
                                                    <td className="px-6 py-3">
                                                        <p className="text-sm font-medium text-white">{event.title}</p>
                                                        {event.competition && <p className="text-xs text-gray-500">{event.competition}</p>}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">{event.sport}</span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="text-xs text-gray-400">
                                                            {formatEventSchedule(event.t_stamp)}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        {/* Quick LIVE toggle */}
                                                        <button
                                                            onClick={() => leToggleLive(event)}
                                                            className={`w-10 h-5 rounded-full transition-colors relative mx-auto ${event.is_live === 't' ? 'bg-red-500' : 'bg-white/10 hover:bg-white/20'
                                                                }`}
                                                            title={event.is_live === 't' ? 'Sembunyikan dari halaman' : 'Tampilkan di halaman live'}
                                                        >
                                                            <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-transform ${event.is_live === 't' ? 'translate-x-[22px]' : 'translate-x-1'
                                                                }`} />
                                                        </button>
                                                    </td>
                                                    <td className="px-6 py-3">
                                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => leHandleEdit(event)}
                                                                className="p-1.5 rounded-lg bg-white/5 hover:bg-indigo-500/20 hover:text-indigo-400 transition-colors"
                                                                title="Edit"
                                                            >
                                                                <Pencil className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setLeDeleteId(event.id);
                                                                    setDeleteId('live-event-trigger'); // Just to open modal
                                                                }}
                                                                className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                                                                title="Hapus"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'settings' && (
                    <div className="space-y-6">
                        <div className="bg-[#0f1117] border border-white/5 rounded-2xl overflow-hidden">
                            <div className="border-b border-white/5 px-6 py-4">
                                <h2 className="font-semibold text-white flex items-center gap-2">
                                    <Settings className="w-4 h-4 text-emerald-400" />
                                    Player Control
                                </h2>
                            </div>
                            {settingsLoading ? (
                                <div className="px-6 py-8 text-sm text-gray-400">Memuat setting...</div>
                            ) : (
                                <div className="px-6 py-6 space-y-5">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-medium text-white">Aktifkan pemutaran siaran Web</p>
                                            <p className="text-xs text-gray-400 mt-1">
                                                Jika dimatikan, player web akan menampilkan pesan: &quot;Maaf siaran tidak tersedia saat ini&quot;.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setPlayerSettings(prev => ({ ...prev, playbackEnabledWeb: !prev.playbackEnabledWeb }))}
                                            className={`w-12 h-6 rounded-full transition-colors relative ${playerSettings.playbackEnabledWeb ? 'bg-emerald-500' : 'bg-white/15'
                                                }`}
                                            aria-label="Toggle web playback"
                                        >
                                            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${playerSettings.playbackEnabledWeb ? 'translate-x-[25px]' : 'translate-x-1'
                                                }`} />
                                        </button>
                                    </div>

                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-medium text-white">Aktifkan pemutaran siaran Mobile</p>
                                            <p className="text-xs text-gray-400 mt-1">
                                                Jika dimatikan, endpoint playback mobile akan mengembalikan status 503.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setPlayerSettings(prev => ({ ...prev, playbackEnabledMobile: !prev.playbackEnabledMobile }))}
                                            className={`w-12 h-6 rounded-full transition-colors relative ${playerSettings.playbackEnabledMobile ? 'bg-teal-500' : 'bg-white/15'
                                                }`}
                                            aria-label="Toggle mobile playback"
                                        >
                                            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${playerSettings.playbackEnabledMobile ? 'translate-x-[25px]' : 'translate-x-1'
                                                }`} />
                                        </button>
                                    </div>

                                    <div className="h-px bg-white/10" />

                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-medium text-white">Aktifkan pre-roll ads</p>
                                            <p className="text-xs text-gray-400 mt-1">
                                                Pilih mode pre-roll: test atau production (1x per hari per IP).
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setPlayerSettings(prev => ({ ...prev, prerollEnabled: !prev.prerollEnabled }))}
                                            className={`w-12 h-6 rounded-full transition-colors relative ${playerSettings.prerollEnabled ? 'bg-indigo-500' : 'bg-white/15'
                                                }`}
                                            aria-label="Toggle preroll"
                                        >
                                            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${playerSettings.prerollEnabled ? 'translate-x-[25px]' : 'translate-x-1'
                                                }`} />
                                        </button>
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs text-gray-400">Mode pre-roll</label>
                                        <select
                                            value={playerSettings.prerollMode}
                                            onChange={(e) => setPlayerSettings(prev => ({
                                                ...prev,
                                                prerollMode: e.target.value === 'production' ? 'production' : 'test',
                                            }))}
                                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                        >
                                            <option value="test" className="bg-gray-900">Test (setiap kali play)</option>
                                            <option value="production" className="bg-gray-900">Production (1x per hari per IP)</option>
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-xs text-gray-400">Durasi pre-roll (detik)</label>
                                            <input
                                                type="number"
                                                min={1}
                                                max={30}
                                                value={playerSettings.prerollDurationSeconds}
                                                onChange={(e) => {
                                                    const value = Number(e.target.value);
                                                    setPlayerSettings(prev => ({
                                                        ...prev,
                                                        prerollDurationSeconds: Math.max(1, Math.min(30, Math.round(Number.isFinite(value) ? value : 5))),
                                                    }));
                                                }}
                                                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-xs text-gray-400">Pre-roll media URL</label>
                                            <input
                                                type="text"
                                                value={playerSettings.prerollMediaUrl}
                                                onChange={(e) => setPlayerSettings(prev => ({ ...prev, prerollMediaUrl: e.target.value }))}
                                                placeholder="https://example.com/ads/preroll.mp4 atau VAST tag URL"
                                                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs text-gray-400">Pre-roll click URL (opsional)</label>
                                        <input
                                            type="text"
                                            value={playerSettings.prerollClickUrl}
                                            onChange={(e) => setPlayerSettings(prev => ({ ...prev, prerollClickUrl: e.target.value }))}
                                            placeholder="https://sponsor.example.com"
                                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>

                                    <div className="h-px bg-white/10" />

                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-medium text-white">Aktifkan Right Sidebar Ads (300x250)</p>
                                            <p className="text-xs text-gray-400 mt-1">
                                                Slot ini ditampilkan di sidebar kanan halaman watch pada desktop.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setPlayerSettings(prev => ({ ...prev, rightSidebarAdEnabled: !prev.rightSidebarAdEnabled }))}
                                            className={`w-12 h-6 rounded-full transition-colors relative ${playerSettings.rightSidebarAdEnabled ? 'bg-amber-500' : 'bg-white/15'
                                                }`}
                                            aria-label="Toggle right sidebar ads"
                                        >
                                            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${playerSettings.rightSidebarAdEnabled ? 'translate-x-[25px]' : 'translate-x-1'
                                                }`} />
                                        </button>
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs text-gray-400">Tipe konten ads</label>
                                        <select
                                            value={playerSettings.rightSidebarAdType}
                                            onChange={(e) => setPlayerSettings(prev => ({
                                                ...prev,
                                                rightSidebarAdType: e.target.value === 'iframe'
                                                    ? 'iframe'
                                                    : e.target.value === 'script'
                                                        ? 'script'
                                                        : 'image',
                                            }))}
                                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                        >
                                            <option value="image" className="bg-gray-900">Image URL</option>
                                            <option value="iframe" className="bg-gray-900">iFrame URL</option>
                                            <option value="script" className="bg-gray-900">Script/HTML</option>
                                        </select>
                                    </div>

                                    {playerSettings.rightSidebarAdType === 'image' && (
                                        <>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-xs text-gray-400">Image URL (300x250 atau 300x600 disarankan)</label>
                                                    <input
                                                        type="text"
                                                        value={playerSettings.rightSidebarAdImageUrl}
                                                        onChange={(e) => setPlayerSettings(prev => ({ ...prev, rightSidebarAdImageUrl: e.target.value }))}
                                                        placeholder="https://cdn.example.com/banner-300x250.jpg"
                                                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-xs text-gray-400">Click URL (opsional)</label>
                                                    <input
                                                        type="text"
                                                        value={playerSettings.rightSidebarAdClickUrl}
                                                        onChange={(e) => setPlayerSettings(prev => ({ ...prev, rightSidebarAdClickUrl: e.target.value }))}
                                                        placeholder="https://sponsor.example.com"
                                                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-xs text-gray-400">Alt Text (opsional)</label>
                                                <input
                                                    type="text"
                                                    value={playerSettings.rightSidebarAdAltText}
                                                    onChange={(e) => setPlayerSettings(prev => ({ ...prev, rightSidebarAdAltText: e.target.value }))}
                                                    placeholder="Sponsored"
                                                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                                />
                                            </div>
                                        </>
                                    )}

                                    {playerSettings.rightSidebarAdType === 'iframe' && (
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-xs text-gray-400">iFrame URL</label>
                                            <input
                                                type="text"
                                                value={playerSettings.rightSidebarAdIframeUrl}
                                                onChange={(e) => setPlayerSettings(prev => ({ ...prev, rightSidebarAdIframeUrl: e.target.value }))}
                                                placeholder="https://ads-network.example/widget"
                                                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                            />
                                        </div>
                                    )}

                                    {playerSettings.rightSidebarAdType === 'script' && (
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-xs text-gray-400">Script / HTML Ads</label>
                                            <textarea
                                                value={playerSettings.rightSidebarAdScript}
                                                onChange={(e) => setPlayerSettings(prev => ({ ...prev, rightSidebarAdScript: e.target.value }))}
                                                rows={6}
                                                placeholder={'<script async src=\"https://example.com/ad.js\"></script>'}
                                                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                                            />
                                            <p className="text-[11px] text-gray-500">
                                                Script dijalankan langsung di slot ads.
                                            </p>
                                        </div>
                                    )}

                                    <div className="h-px bg-white/10" />

                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-medium text-white">Aktifkan Top Player Ads (728x90 / 970x90)</p>
                                            <p className="text-xs text-gray-400 mt-1">
                                                Slot ini ditampilkan di atas player pada perangkat desktop/tablet.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setPlayerSettings(prev => ({ ...prev, topPlayerAdEnabled: !prev.topPlayerAdEnabled }))}
                                            className={`w-12 h-6 rounded-full transition-colors relative ${playerSettings.topPlayerAdEnabled ? 'bg-cyan-500' : 'bg-white/15'
                                                }`}
                                            aria-label="Toggle top player ads"
                                        >
                                            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${playerSettings.topPlayerAdEnabled ? 'translate-x-[25px]' : 'translate-x-1'
                                                }`} />
                                        </button>
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs text-gray-400">Tipe konten top ads (728x90 / 970x90)</label>
                                        <select
                                            value={playerSettings.topPlayerAdType}
                                            onChange={(e) => setPlayerSettings(prev => ({
                                                ...prev,
                                                topPlayerAdType: e.target.value === 'iframe'
                                                    ? 'iframe'
                                                    : e.target.value === 'script'
                                                        ? 'script'
                                                        : 'image',
                                            }))}
                                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                        >
                                            <option value="image" className="bg-gray-900">Image URL</option>
                                            <option value="iframe" className="bg-gray-900">iFrame URL</option>
                                            <option value="script" className="bg-gray-900">Script/HTML</option>
                                        </select>
                                    </div>

                                    {playerSettings.topPlayerAdType === 'image' && (
                                        <>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-xs text-gray-400">Image URL (728x90 atau 970x90 disarankan)</label>
                                                    <input
                                                        type="text"
                                                        value={playerSettings.topPlayerAdImageUrl}
                                                        onChange={(e) => setPlayerSettings(prev => ({ ...prev, topPlayerAdImageUrl: e.target.value }))}
                                                        placeholder="https://cdn.example.com/banner-728x90.jpg"
                                                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-xs text-gray-400">Click URL (opsional)</label>
                                                    <input
                                                        type="text"
                                                        value={playerSettings.topPlayerAdClickUrl}
                                                        onChange={(e) => setPlayerSettings(prev => ({ ...prev, topPlayerAdClickUrl: e.target.value }))}
                                                        placeholder="https://sponsor.example.com"
                                                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-xs text-gray-400">Alt Text (opsional)</label>
                                                <input
                                                    type="text"
                                                    value={playerSettings.topPlayerAdAltText}
                                                    onChange={(e) => setPlayerSettings(prev => ({ ...prev, topPlayerAdAltText: e.target.value }))}
                                                    placeholder="Sponsored"
                                                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                                />
                                            </div>
                                        </>
                                    )}

                                    {playerSettings.topPlayerAdType === 'iframe' && (
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-xs text-gray-400">iFrame URL</label>
                                            <input
                                                type="text"
                                                value={playerSettings.topPlayerAdIframeUrl}
                                                onChange={(e) => setPlayerSettings(prev => ({ ...prev, topPlayerAdIframeUrl: e.target.value }))}
                                                placeholder="https://ads-network.example/widget-728x90"
                                                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                            />
                                        </div>
                                    )}

                                    {playerSettings.topPlayerAdType === 'script' && (
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-xs text-gray-400">Script / HTML Top Ads</label>
                                            <textarea
                                                value={playerSettings.topPlayerAdScript}
                                                onChange={(e) => setPlayerSettings(prev => ({ ...prev, topPlayerAdScript: e.target.value }))}
                                                rows={5}
                                                placeholder={'<script async src=\"https://example.com/ad-728x90.js\"></script>'}
                                                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                                            />
                                        </div>
                                    )}

                                    <div className="h-px bg-white/10" />

                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-medium text-white">Aktifkan Mobile Fallback Ads</p>
                                            <p className="text-xs text-gray-400 mt-1">
                                                Slot ini dipakai di mobile (contoh: 300x250) sebagai fallback untuk top ads.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setPlayerSettings(prev => ({
                                                ...prev,
                                                topPlayerMobileFallbackEnabled: !prev.topPlayerMobileFallbackEnabled,
                                            }))}
                                            className={`w-12 h-6 rounded-full transition-colors relative ${playerSettings.topPlayerMobileFallbackEnabled ? 'bg-teal-500' : 'bg-white/15'
                                                }`}
                                            aria-label="Toggle top player mobile fallback ads"
                                        >
                                            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${playerSettings.topPlayerMobileFallbackEnabled ? 'translate-x-[25px]' : 'translate-x-1'
                                                }`} />
                                        </button>
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs text-gray-400">Tipe konten mobile fallback</label>
                                        <select
                                            value={playerSettings.topPlayerMobileFallbackType}
                                            onChange={(e) => setPlayerSettings(prev => ({
                                                ...prev,
                                                topPlayerMobileFallbackType: e.target.value === 'iframe'
                                                    ? 'iframe'
                                                    : e.target.value === 'script'
                                                        ? 'script'
                                                        : 'image',
                                            }))}
                                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                        >
                                            <option value="image" className="bg-gray-900">Image URL</option>
                                            <option value="iframe" className="bg-gray-900">iFrame URL</option>
                                            <option value="script" className="bg-gray-900">Script/HTML</option>
                                        </select>
                                    </div>

                                    {playerSettings.topPlayerMobileFallbackType === 'image' && (
                                        <>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-xs text-gray-400">Image URL (300x250 disarankan)</label>
                                                    <input
                                                        type="text"
                                                        value={playerSettings.topPlayerMobileFallbackImageUrl}
                                                        onChange={(e) => setPlayerSettings(prev => ({ ...prev, topPlayerMobileFallbackImageUrl: e.target.value }))}
                                                        placeholder="https://cdn.example.com/banner-320x50.jpg"
                                                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-xs text-gray-400">Click URL (opsional)</label>
                                                    <input
                                                        type="text"
                                                        value={playerSettings.topPlayerMobileFallbackClickUrl}
                                                        onChange={(e) => setPlayerSettings(prev => ({ ...prev, topPlayerMobileFallbackClickUrl: e.target.value }))}
                                                        placeholder="https://sponsor.example.com"
                                                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-xs text-gray-400">Alt Text (opsional)</label>
                                                <input
                                                    type="text"
                                                    value={playerSettings.topPlayerMobileFallbackAltText}
                                                    onChange={(e) => setPlayerSettings(prev => ({ ...prev, topPlayerMobileFallbackAltText: e.target.value }))}
                                                    placeholder="Sponsored"
                                                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                                />
                                            </div>
                                        </>
                                    )}

                                    {playerSettings.topPlayerMobileFallbackType === 'iframe' && (
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-xs text-gray-400">iFrame URL</label>
                                            <input
                                                type="text"
                                                value={playerSettings.topPlayerMobileFallbackIframeUrl}
                                                onChange={(e) => setPlayerSettings(prev => ({ ...prev, topPlayerMobileFallbackIframeUrl: e.target.value }))}
                                                placeholder="https://ads-network.example/widget-320x50"
                                                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                            />
                                        </div>
                                    )}

                                    {playerSettings.topPlayerMobileFallbackType === 'script' && (
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-xs text-gray-400">Script / HTML Mobile Fallback</label>
                                            <textarea
                                                value={playerSettings.topPlayerMobileFallbackScript}
                                                onChange={(e) => setPlayerSettings(prev => ({ ...prev, topPlayerMobileFallbackScript: e.target.value }))}
                                                rows={5}
                                                placeholder={'<script async src=\"https://example.com/ad-320x50.js\"></script>'}
                                                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                                            />
                                        </div>
                                    )}

                                    <div className="text-xs text-gray-400">
                                        Playback Web:{' '}
                                        <span className={playerSettings.playbackEnabledWeb ? 'text-emerald-400' : 'text-red-400'}>
                                            {playerSettings.playbackEnabledWeb ? 'AKTIF' : 'NONAKTIF'}
                                        </span>
                                        <span className="mx-2 text-gray-600">|</span>
                                        Playback Mobile:{' '}
                                        <span className={playerSettings.playbackEnabledMobile ? 'text-teal-400' : 'text-red-400'}>
                                            {playerSettings.playbackEnabledMobile ? 'AKTIF' : 'NONAKTIF'}
                                        </span>
                                        <span className="mx-2 text-gray-600">|</span>
                                        Status pre-roll:{' '}
                                        <span className={playerSettings.prerollEnabled ? 'text-indigo-400' : 'text-gray-500'}>
                                            {playerSettings.prerollEnabled ? 'AKTIF' : 'NONAKTIF'}
                                        </span>
                                        <span className="mx-2 text-gray-600">|</span>
                                        Mode:{' '}
                                        <span className="text-gray-300">
                                            {playerSettings.prerollMode === 'production'
                                                ? 'Production (1x/hari/IP)'
                                                : 'Test (setiap kali)'}
                                        </span>
                                        <span className="mx-2 text-gray-600">|</span>
                                        Sidebar ads:{' '}
                                        <span className={playerSettings.rightSidebarAdEnabled ? 'text-amber-400' : 'text-gray-500'}>
                                            {playerSettings.rightSidebarAdEnabled ? 'AKTIF' : 'NONAKTIF'}
                                        </span>
                                        <span className="mx-2 text-gray-600">|</span>
                                        Tipe:{' '}
                                        <span className="text-gray-300 uppercase">
                                            {playerSettings.rightSidebarAdType}
                                        </span>
                                        <span className="mx-2 text-gray-600">|</span>
                                        Top ads:{' '}
                                        <span className={playerSettings.topPlayerAdEnabled ? 'text-cyan-400' : 'text-gray-500'}>
                                            {playerSettings.topPlayerAdEnabled ? 'AKTIF' : 'NONAKTIF'}
                                        </span>
                                        <span className="mx-2 text-gray-600">|</span>
                                        Mobile fallback:{' '}
                                        <span className={playerSettings.topPlayerMobileFallbackEnabled ? 'text-teal-400' : 'text-gray-500'}>
                                            {playerSettings.topPlayerMobileFallbackEnabled ? 'AKTIF' : 'NONAKTIF'}
                                        </span>
                                    </div>

                                    <div className="text-xs text-gray-500">
                                        Terakhir diubah:{' '}
                                        {playerSettings.updatedAt
                                            ? new Date(playerSettings.updatedAt).toLocaleString('id-ID')
                                            : '-'}
                                    </div>

                                    <div className="pt-2">
                                        <button
                                            type="button"
                                            onClick={savePlayerSettings}
                                            disabled={settingsSaving}
                                            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-700/40 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                                        >
                                            {settingsSaving ? (
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                <Save className="w-4 h-4" />
                                            )}
                                            Simpan Setting
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
