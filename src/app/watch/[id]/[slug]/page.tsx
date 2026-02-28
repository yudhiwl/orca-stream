import type { Metadata } from 'next';
import Link from 'next/link';
import WatchClient from '@/components/WatchClient';
import Navbar from '@/components/Navbar';
import { ChevronRight } from 'lucide-react';
import { buildWebPage, buildWebApplication, buildJsonLd, buildVideoObject, buildWebSite, buildOrganization, SITE_URL } from '@/lib/schema';
import { toSlug } from '@/lib/slug';
import { isLiveEventWatchId, toLiveEventSourceId, toLiveEventWatchId } from '@/lib/live-event-id';
import { sanitizeChannelForClient, sanitizeChannelsForClient } from '@/lib/playback-security';
import { Channel } from '@/types/channel';
import { LiveEvent } from '@/types/live-event';
import { SITE_NAME } from '@/lib/site-config';
import { readPublicUiSettings } from '@/lib/ui-settings-public';
import fs from 'fs';
import path from 'path';

interface PageProps {
    params: Promise<{ id: string; slug: string }>;
}

export const revalidate = 120;

function readLiveEvents(): LiveEvent[] {
    try {
        const file = path.join(process.cwd(), 'src', 'data', 'live-events.json');
        const raw = fs.readFileSync(file, 'utf-8').replace(/^\uFEFF/, '');
        return JSON.parse(raw) as LiveEvent[];
    } catch {
        return [];
    }
}

function mapLiveEventToChannel(event: LiveEvent): Channel {
    const watchId = toLiveEventWatchId(event.id);
    return {
        id: watchId,
        name: event.title,
        namespace: `event-${watchId}`,
        image: event.thumbnail || '',
        hls: event.hls,
        jenis: event.jenis,
        category: event.category,
        tagline: event.competition || '',
        is_live: event.is_live,
        header_iptv: event.header_iptv || '',
        url_license: event.url_license || '',
        country_name: 'Live Sports',
        alpha_2_code: 'EV',
        premium: 'f',
        fake_event: 'f',
        t_stamp: event.t_stamp || 'none',
        s_stamp: event.s_stamp || 'none',
        is_movie: 'f',
        subtitle: '',
        header_license: event.header_license || ''
    };
}

function getLiveEventChannel(routeId: string): Channel | null {
    const sourceId = toLiveEventSourceId(routeId);
    const events = readLiveEvents();
    const event = events.find(
        e => e.id === routeId || e.id === sourceId
    );
    return event ? mapLiveEventToChannel(event) : null;
}

function readTvChannels(): Channel[] {
    try {
        const file = path.join(process.cwd(), 'src', 'data', 'channels.json');
        const raw = fs.readFileSync(file, 'utf-8').replace(/^\uFEFF/, '');
        const parsed = JSON.parse(raw) as unknown;
        return Array.isArray(parsed) ? (parsed as Channel[]) : [];
    } catch {
        return [];
    }
}

function getTvChannel(id: string): Channel | null {
    return readTvChannels().find(c => c.id === id) ?? null;
}

function getMovieChannel(id: string): Channel | null {
    try {
        const file = path.join(process.cwd(), 'src', 'data', 'movie.json');
        const raw = fs.readFileSync(file, 'utf-8').replace(/^\uFEFF/, '').trim();
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { info?: Channel[] };
        const list = Array.isArray(parsed?.info) ? parsed.info : [];
        return list.find(c => c.id === id) ?? null;
    } catch {
        return null;
    }
}

function getChannel(id: string): Channel | null {
    try {
        if (isLiveEventWatchId(id)) {
            return getLiveEventChannel(id);
        }

        const tvChannel = getTvChannel(id);
        if (tvChannel) return tvChannel;

        // Check movie.json for movie channels
        const movieChannel = getMovieChannel(id);
        if (movieChannel) return movieChannel;

        // Backward compatibility for old live-event links that used raw numeric IDs.
        return getLiveEventChannel(id);
    } catch {
        return null;
    }
}

function isIndonesiaChannel(channel: Channel | null): boolean {
    if (!channel) return false;
    const countryCode = (channel.alpha_2_code || '').trim().toUpperCase();
    const countryName = (channel.country_name || '').trim().toLowerCase();
    return countryCode === 'ID' || countryName === 'indonesia';
}

function isSportChannel(channel: Channel | null): boolean {
    if (!channel) return false;
    const category = (channel.category || '').trim().toLowerCase();
    return category.includes('sport');
}

function isMovieChannel(channel: Channel | null): boolean {
    if (!channel) return false;
    const isMovieFlag = (channel.is_movie || '').trim().toLowerCase() === 't';
    const countryCode = (channel.alpha_2_code || '').trim().toUpperCase();
    const countryName = (channel.country_name || '').trim().toLowerCase();
    return isMovieFlag || countryCode === 'MI' || countryName === 'movies';
}

function isEventWatchRoute(routeId: string, channel: Channel | null): boolean {
    return (
        routeId.startsWith('le-') ||
        (channel?.id || '').startsWith('le-') ||
        (channel?.country_name || '').trim().toLowerCase() === 'live sports' ||
        (channel?.category || '').trim().toLowerCase() === 'events'
    );
}

function getSidebarChannels(routeId: string, channel: Channel | null): Channel[] {
    const baseChannels = sanitizeChannelsForClient(readTvChannels());
    if (!isEventWatchRoute(routeId, channel)) return baseChannels;

    const eventChannels = sanitizeChannelsForClient(
        readLiveEvents().map(mapLiveEventToChannel)
    );
    const deduped = new Map<string, Channel>();
    for (const item of [...eventChannels, ...baseChannels]) {
        if (!item?.id) continue;
        deduped.set(item.id, item);
    }
    return Array.from(deduped.values());
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { id } = await params;
    const channel = getChannel(id);
    if (!channel) {
        return { title: 'Channel Tidak Ditemukan' };
    }
    const watchId = channel.id || id;
    const title = `${channel.name} Live Streaming`;
    const description =
        channel.tagline
            ? `Tonton ${channel.name} live streaming online. ${channel.tagline}. Siaran langsung gratis di ${SITE_NAME}.`
            : `Tonton ${channel.name} live streaming online gratis di ${SITE_NAME}. Siaran langsung tanpa buffering.`;
    const url = `${SITE_URL}/watch/${watchId}/${toSlug(channel.name)}`;

    return {
        title,
        description,
        alternates: { canonical: url },
        openGraph: {
            siteName: SITE_NAME,
            locale: 'id_ID',
            title,
            description,
            url,
            type: 'website',
            images: channel.image ? [{ url: channel.image, alt: channel.name }] : [],
        },
        twitter: { card: 'summary_large_image', title, description },
    };
}

export default async function WatchPage({ params }: PageProps) {
    const { id } = await params;
    const channel = getChannel(id);
    const watchId = channel?.id ?? id;
    const initialChannels = getSidebarChannels(id, channel);
    const uiSettings = readPublicUiSettings();

    const channelName = channel?.name ?? 'Channel';
    const channelTagline = channel?.tagline ?? '';
    const channelCountry = channel?.country_name ?? '';
    const channelCategory = channel?.category ?? 'General';
    const pageUrl = `${SITE_URL}/watch/${watchId}/${channel ? toSlug(channel.name) : watchId}`;
    const isIndonesia = isIndonesiaChannel(channel);
    const isSport = isSportChannel(channel);
    const isMovie = isMovieChannel(channel);
    const countryLabel = (channel?.country_name || 'Indonesia').trim() || 'Indonesia';

    // Build breadcrumb chain based on channel type
    const breadcrumbItems = isIndonesia
        ? [
            { name: 'Beranda', href: '/', url: SITE_URL },
            { name: countryLabel, href: '/channel-indonesia', url: `${SITE_URL}/channel-indonesia` },
            { name: channelName, href: null, url: pageUrl },
        ]
        : isSport
            ? [
                { name: 'Beranda', href: '/', url: SITE_URL },
                { name: 'Channel Sport', href: '/channel-sport', url: `${SITE_URL}/channel-sport` },
                { name: channelName, href: null, url: pageUrl },
            ]
            : isMovie
                ? [
                    { name: 'Beranda', href: '/', url: SITE_URL },
                    { name: 'Movie', href: '/movie', url: `${SITE_URL}/movie` },
                    { name: channelName, href: null, url: pageUrl },
                ]
                : [
                    { name: 'Beranda', href: '/', url: SITE_URL },
                    { name: channelName, href: null, url: pageUrl },
                ];

    const pageJsonLd = buildJsonLd([
        buildWebPage({
            id: `${pageUrl}#webpage`,
            url: pageUrl,
            name: `${channelName} Live Streaming | ${SITE_NAME}`,
            description: channelTagline
                ? `Tonton ${channelName} live streaming. ${channelTagline}`
                : `Tonton ${channelName} live streaming online gratis di ${SITE_NAME}.`,
            breadcrumb: breadcrumbItems.map((item) => ({ name: item.name, url: item.url })),
        }),
        buildWebApplication({
            name: `${channelName} Live Stream - ${SITE_NAME}`,
            description: `Streaming langsung ${channelName} di ${SITE_NAME}. ${channelTagline}`,
            url: pageUrl,
        }),
        // VideoObject: signals to Google this is a streamable video/broadcast content
        buildVideoObject({
            name: `${channelName} Live Streaming`,
            description: channelTagline
                ? `Tonton ${channelName} live streaming online. ${channelTagline}`
                : `Tonton ${channelName} live streaming online gratis di ${SITE_NAME}.`,
            thumbnailUrl: channel?.image ? `${SITE_URL}${channel.image}` : `${SITE_URL}/icons/logo.svg`,
            watchUrl: pageUrl,
            isLive: channel?.is_live === 't',
        }),
        buildWebSite(),
        buildOrganization(),
    ]);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#080a0f] text-gray-900 dark:text-white flex flex-col">
            {/* JSON-LD */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(pageJsonLd) }}
            />

            {/* Navbar */}
            <Navbar />

            {/* Breadcrumb - below navbar, above content */}
            {channel && (
                <div className="max-w-screen-2xl mx-auto w-full px-3 sm:px-4 pt-3">
                    <nav aria-label="Breadcrumb">
                        <ol className="flex items-center gap-1.5 text-sm font-medium text-gray-500 list-none" itemScope itemType="https://schema.org/BreadcrumbList">
                            {breadcrumbItems.map((item, index) => (
                                <li
                                    key={`${item.name}-${index}`}
                                    className="flex items-center"
                                    itemProp="itemListElement"
                                    itemScope
                                    itemType="https://schema.org/ListItem"
                                >
                                    {item.href ? (
                                        <Link
                                            href={item.href}
                                            className="text-gray-600 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-gray-300 transition-colors flex items-center"
                                            itemProp="item"
                                        >
                                            <span itemProp="name">{item.name}</span>
                                        </Link>
                                    ) : (
                                        <span className="text-gray-400 dark:text-gray-300 truncate max-w-[180px] sm:max-w-none" itemProp="name">
                                            {item.name}
                                        </span>
                                    )}
                                    <meta itemProp="position" content={String(index + 1)} />
                                    {index < breadcrumbItems.length - 1 && (
                                        <span aria-hidden="true" className="ml-1.5 flex items-center text-gray-400 dark:text-gray-700">
                                            <ChevronRight className="w-3.5 h-3.5" />
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ol>
                    </nav>
                </div>
            )}

            {/* Main layout - client interactivity */}
            <div className="flex-1 max-w-screen-2xl mx-auto w-full px-3 sm:px-4 py-4 sm:py-5">
                <WatchClient
                    initialChannelId={watchId}
                    initialChannels={initialChannels}
                    initialChannel={channel ? sanitizeChannelForClient(channel) : null}
                    initialTopPlayerAd={uiSettings.topPlayerAd}
                    initialTopPlayerMobileFallbackAd={uiSettings.topPlayerMobileFallbackAd}
                    initialRightSidebarAd={uiSettings.rightSidebarAd}
                    seoContent={
                        <>
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-snug">
                                {channelName} Live Streaming Online Gratis
                            </h1>

                            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                                Selamat datang di halaman streaming langsung {channelName} di {SITE_NAME}.
                                {channelCountry && ` Channel ini berasal dari ${channelCountry}.`}
                                {' '}Nikmati siaran langsung {channelName} secara online gratis tanpa perlu berlangganan.
                            </p>
                            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 border-l-2 border-indigo-500 pl-3">
                                Tentang {channelName}
                            </h2>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                {channelName} adalah channel TV{channelCountry ? ` asal ${channelCountry}` : ''} dalam kategori {channelCategory}.
                                {channelTagline && ` ${channelTagline}.`}
                                {' '}Dengan {SITE_NAME}, kamu dapat menonton siaran langsung {channelName} kapan saja dan di mana saja
                                hanya dengan koneksi internet - tanpa perlu kabel TV atau antena.
                            </p>
                            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 border-l-2 border-indigo-500 pl-3">
                                Cara Menonton {channelName} Live Streaming
                            </h2>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                Menonton {channelName} live di {SITE_NAME} sangat mudah. Setelah halaman ini dimuat,
                                video player akan otomatis memulai stream. Gunakan kontrol player untuk mengatur volume,
                                layar penuh, dan kualitas video. Kamu juga dapat memilih channel TV lainnya dari daftar
                                channel di sebelah kiri tanpa perlu kembali ke halaman utama.
                            </p>
                            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 border-l-2 border-indigo-500 pl-3">
                                {`Channel TV Lainnya di ${SITE_NAME}`}
                            </h2>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                {SITE_NAME} menyediakan berbagai channel TV dari Indonesia dan seluruh dunia.
                                Temukan channel berita, olahraga, hiburan, film, musik, dan program anak-anak.
                                Gunakan fitur filter kategori dan negara untuk menemukan channel yang kamu cari
                                dengan lebih mudah dan cepat.
                            </p>
                        </>
                    }
                />
            </div>
        </div>
    );
}



