import type { Metadata } from 'next';
import { Radio } from 'lucide-react';
import LiveSportsClient from '@/components/LiveSportsClient';
import Navbar from '@/components/Navbar';
import PageTopDesktopAd from '@/components/PageTopDesktopAd';
import RightSidebarAdSlot from '@/components/RightSidebarAdSlot';
import DesktopSidebarFlexibleAd from '@/components/DesktopSidebarFlexibleAd';
import SidebarInfoCard from '@/components/SidebarInfoCard';
import { buildWebPage, buildWebApplication, buildFAQPage, buildJsonLd, SITE_URL } from '@/lib/schema';
import { sanitizeLiveEventsForClient } from '@/lib/playback-security';
import { buildPublicLiveSportsFeed } from '@/lib/live-sports-feed';
import { LiveEvent } from '@/types/live-event';
import { SITE_NAME } from '@/lib/site-config';
import { readPublicUiSettings } from '@/lib/ui-settings-public';
import fs from 'fs';
import path from 'path';

const PAGE_URL = `${SITE_URL}/live-sports`;
export const revalidate = 60;

function getLiveEvents(): { events: LiveEvent[]; liveCount: number } {
    try {
        const file = path.join(process.cwd(), 'src', 'data', 'live-events.json');
        const raw = fs.readFileSync(file, 'utf-8').replace(/^\uFEFF/, '');
        const data = JSON.parse(raw) as LiveEvent[];
        return buildPublicLiveSportsFeed(data);
    } catch {
        return { events: [], liveCount: 0 };
    }
}

// Format today's date in Bahasa Indonesia
function getTodayLabel(): string {
    return new Date().toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Jakarta',
    });
}

// FAQ content - must match visible FAQ section below (Google policy)
const SPORTS_FAQ_ITEMS = [
    {
        question: `Bagaimana cara nonton live streaming olahraga di ${SITE_NAME}?`,
        answer:
            `Buka halaman Live Sports di ${SITE_NAME}, pilih pertandingan yang ingin ditonton, lalu klik untuk mulai streaming. Pertandingan yang sedang berlangsung ditandai dengan badge merah "LIVE".`,
    },
    {
        question: `Olahraga apa saja yang bisa ditonton di ${SITE_NAME}?`,
        answer:
            `${SITE_NAME} menyediakan live streaming berbagai cabang olahraga termasuk sepak bola (Liga Indonesia, Liga Inggris, Liga Champions), bulu tangkis, Formula 1, MotoGP, basket NBA, tenis, tinju, dan MMA.`,
    },
    {
        question: `Apakah live streaming olahraga di ${SITE_NAME} gratis?`,
        answer:
            `Ya, semua siaran olahraga di ${SITE_NAME} tersedia sepenuhnya gratis tanpa biaya berlangganan dan tanpa perlu membuat akun terlebih dahulu.`,
    },
    {
        question: `Berapa jam sebelum pertandingan jadwal live muncul di ${SITE_NAME}?`,
        answer:
            'Jadwal pertandingan biasanya muncul beberapa jam sebelum kick-off. Halaman ini diperbarui secara real-time, jadi kamu bisa refresh halaman untuk melihat jadwal terbaru.',
    },
    {
        question: 'Kenapa tidak ada pertandingan di halaman Live Sports?',
        answer:
            'Halaman Live Sports hanya menampilkan pertandingan yang sedang berlangsung (LIVE) dan yang akan segera dimulai (upcoming). Jika tidak ada event, berarti saat ini tidak ada pertandingan yang dijadwalkan.',
    },
    {
        question: 'Apakah bisa nonton di HP/smartphone?',
        answer:
            `Ya, ${SITE_NAME} bisa diakses dari browser di HP, tablet, maupun komputer tanpa perlu install aplikasi apapun.`,
    },
];

export const metadata: Metadata = {
    title: 'Live Streaming Olahraga Hari Ini',
    description:
        `Nonton live streaming olahraga hari ini gratis: sepak bola, bulu tangkis, Formula 1, basket, dan cabang olahraga lainnya. Siaran langsung tanpa buffering di ${SITE_NAME}.`,
    alternates: { canonical: PAGE_URL },
    openGraph: {
        siteName: SITE_NAME,
        locale: 'id_ID',
        title: `Live Streaming Olahraga Hari Ini | ${SITE_NAME}`,
        description:
            'Nonton live streaming olahraga hari ini gratis. Sepak bola, bulu tangkis, F1, dan banyak lagi.',
        url: PAGE_URL,
        type: 'website',
    },
    twitter: {
        title: `Live Streaming Olahraga Hari Ini | ${SITE_NAME}`,
        description: `Nonton live streaming olahraga hari ini gratis di ${SITE_NAME}.`,
    },
};

export default function LiveSportsPage() {
    const { events, liveCount } = getLiveEvents();
    const safeEvents = sanitizeLiveEventsForClient(events);
    const todayLabel = getTodayLabel();
    const uiSettings = readPublicUiSettings();

    // Build JSON-LD for the page
    const pageJsonLd = buildJsonLd([
        buildWebPage({
            id: `${PAGE_URL}#webpage`,
            url: PAGE_URL,
            name: `Live Streaming Olahraga Hari Ini | ${SITE_NAME}`,
            description:
                `Nonton live streaming olahraga hari ini gratis di ${SITE_NAME}. Sepak bola, bulu tangkis, Formula 1, dan cabang olahraga lainnya.`,
            breadcrumb: [
                { name: 'Beranda', url: SITE_URL },
                { name: 'Live Sports', url: PAGE_URL },
            ],
        }),
        buildWebApplication({
            name: `${SITE_NAME} Live Sports`,
            description:
                'Nonton live streaming olahraga hari ini gratis. Sepak bola, bulu tangkis, Formula 1, basket, dan lebih banyak lagi.',
            url: PAGE_URL,
        }),
        buildFAQPage(SPORTS_FAQ_ITEMS),
    ]);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#080a0f] text-gray-900 dark:text-white flex flex-col">
            {/* JSON-LD */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(pageJsonLd) }}
            />

            {/* Navbar */}
            <Navbar badge={
                liveCount > 0 ? (
                    <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full">
                        <Radio className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                        <span className="text-xs font-semibold text-red-400 whitespace-nowrap">{liveCount} Live</span>
                    </div>
                ) : undefined
            } />

            {/* Hero */}
            <div className="max-w-screen-xl mx-auto w-full px-3 sm:px-4 pt-6 sm:pt-8 pb-3 sm:pb-4">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                    Live Streaming Olahraga Hari Ini
                </h1>
                <p className="text-indigo-400 text-sm font-medium mt-1">{todayLabel}</p>
            </div>

            {/* Main content */}
            <div className="flex-1 max-w-screen-xl mx-auto w-full px-3 sm:px-4 pb-10">
                <PageTopDesktopAd
                    ad={uiSettings.topPlayerAd}
                    mobileAd={uiSettings.topPlayerMobileFallbackAd}
                    fallbackAd={uiSettings.topPlayerAd}
                    id="ad-slot-live-sports-top-desktop"
                    mobileId="ad-slot-live-sports-top-mobile-inline"
                    className="mb-5"
                />

                <div className="flex flex-col lg:flex-row gap-6">
                    <div className="flex-1 min-w-0">
                        <LiveSportsClient events={safeEvents} />

                        {/* SEO Content */}
                        <div className="mt-12 border-t border-black/5 dark:border-white/5 pt-8 grid gap-5 md:grid-cols-2">
                            <div>
                                <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 border-l-2 border-indigo-500 pl-3 mb-3">
                                    Nonton Live Streaming Olahraga Gratis
                                </h2>
                                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                                    {SITE_NAME} menyediakan siaran langsung berbagai pertandingan olahraga dari seluruh dunia
                                    secara gratis dan tanpa registrasi. Nikmati kualitas streaming HD langsung dari browser
                                    kamu tanpa perlu mengunduh aplikasi apapun.
                                </p>
                            </div>
                            <div>
                                <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 border-l-2 border-indigo-500 pl-3 mb-3">
                                    Berbagai Cabang Olahraga
                                </h2>
                                <p className="text-gray-500 text-sm leading-relaxed">
                                    Dari sepak bola Liga Indonesia, Liga Inggris, Liga Champions, bulu tangkis BWF,
                                    Formula 1, MotoGP, NBA, tenis Grand Slam, hingga MMA dan tinju - semua tersedia
                                    di {SITE_NAME}.
                                </p>
                            </div>
                            <div>
                                <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 border-l-2 border-indigo-500 pl-3 mb-3">
                                    Jadwal Live Olahraga Real-Time
                                </h2>
                                <p className="text-gray-500 text-sm leading-relaxed">
                                    Halaman ini diperbarui secara real-time setiap hari. Setiap pertandingan yang sedang
                                    berlangsung ditandai dengan badge LIVE berwarna merah.
                                </p>
                            </div>
                            <div>
                                <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 border-l-2 border-indigo-500 pl-3 mb-3">
                                    Kualitas Streaming Adaptif
                                </h2>
                                <p className="text-gray-500 text-sm leading-relaxed">
                                    {SITE_NAME} menggunakan teknologi adaptive streaming (DASH/HLS) yang secara otomatis
                                    menyesuaikan kualitas video dengan kecepatan internet kamu.
                                </p>
                            </div>
                        </div>
                    </div>

                    <aside className="hidden lg:block w-[320px] flex-shrink-0">
                        <div className="sticky top-20 flex flex-col gap-5">
                            <DesktopSidebarFlexibleAd
                                ad={uiSettings.rightSidebarAd}
                                id="ad-slot-live-sports-sidebar"
                                iframeTitle="Sidebar Ad 300x600"
                                placeholderLabel="Sidebar Ad 300x250 / 300x600"
                            />

                            <div className="bg-white dark:bg-[#0f1117] border border-black/8 dark:border-white/5 rounded-2xl p-4">
                                <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider mb-4 border-b border-black/5 dark:border-white/5 pb-2">
                                    Info Layanan
                                </h2>
                                <ul className="space-y-3">
                                    <li className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                                        <div className="w-1 h-1 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                                        <span>Update jadwal otomatis setiap 60 detik.</span>
                                    </li>
                                    <li className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                                        <div className="w-1 h-1 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                                        <span>Streaming gratis tanpa akun/registrasi.</span>
                                    </li>
                                    <li className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                                        <div className="w-1 h-1 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                                        <span>Mendukung resolusi HD hingga 1080p.</span>
                                    </li>
                                </ul>
                            </div>

                            <SidebarInfoCard />
                        </div>
                    </aside>
                </div>

                {/* FAQ Section */}
                <div className="mt-10 border-t border-black/5 dark:border-white/5 pt-8">
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-6">
                        Pertanyaan yang Sering Ditanyakan (FAQ)
                    </h2>
                    <div className="grid gap-4 md:grid-cols-2">
                        {SPORTS_FAQ_ITEMS.map((faq, i) => (
                            <article key={i} className="bg-black/2 dark:bg-white/[0.03] border border-black/5 dark:border-white/5 rounded-xl p-4">
                                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">{faq.question}</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{faq.answer}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </div>

        </div>
    );
}
