import type { Metadata } from 'next';
import HomeClient from '@/components/HomeClient';
import IndonesiaChannelsSection from '@/components/IndonesiaChannelsSection';
import SportChannelsSection from '@/components/SportChannelsSection';
import MovieChannelsSection from '@/components/MovieChannelsSection';
import Navbar from '@/components/Navbar';
import PageTopDesktopAd from '@/components/PageTopDesktopAd';
import { buildWebPage, buildWebApplication, buildFAQPage, buildJsonLd, buildWebSite, buildOrganization, SITE_URL } from '@/lib/schema';
import { SITE_DOMAIN, SITE_NAME } from '@/lib/site-config';
import { readChannelsData, readMovieChannelsData, sanitizeChannelsForClient } from '@/lib/playback-security';
import type { Channel } from '@/types/channel';
import { AdSettings, RightSidebarAdSettings } from '@/lib/right-sidebar-ad';
import { readPublicUiSettings } from '@/lib/ui-settings-public';

const PAGE_URL = SITE_URL;
export const revalidate = 300;

export const metadata: Metadata = {
  title: `${SITE_NAME} - Nonton TV Live Streaming Online Gratis`,
  description:
    `Tonton siaran TV live online gratis di ${SITE_NAME}. Channel Indonesia dan dunia tersedia: berita, olahraga, hiburan, anak-anak, dan film - tanpa registrasi.`,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    siteName: SITE_NAME,
    locale: 'id_ID',
    title: `${SITE_NAME} - Nonton TV Live Streaming Online Gratis`,
    description:
      `Tonton siaran TV live online gratis di ${SITE_NAME}. Channel Indonesia dan dunia tersedia: berita, olahraga, hiburan, anak-anak, dan film.`,
    url: PAGE_URL,
    type: 'website',
  },
  twitter: {
    title: `${SITE_NAME} - Nonton TV Live Streaming Online Gratis`,
    description:
      `Tonton siaran TV live online gratis di ${SITE_NAME}. Channel Indonesia dan dunia tersedia.`,
  },
};

// FAQ content - must match visible FAQ section below (Google policy)
const FAQ_ITEMS = [
  {
    question: `Apakah ${SITE_NAME} gratis?`,
    answer:
      `Ya, ${SITE_NAME} sepenuhnya gratis. Kamu bisa menonton ratusan channel TV live streaming tanpa biaya berlangganan dan tanpa perlu membuat akun.`,
  },
  {
    question: `Channel apa saja yang tersedia di ${SITE_NAME}?`,
    answer:
      `${SITE_NAME} menyediakan channel TV Indonesia seperti RCTI, SCTV, ANTV, Trans7, TransTV, MetroTV, CNN Indonesia, dan channel internasional seperti BBC, CNN, Al Jazeera, serta channel olahraga, hiburan, anak-anak, dan berita dari berbagai negara.`,
  },
  {
    question: 'Apakah perlu install aplikasi untuk menonton?',
    answer:
      `Tidak perlu. ${SITE_NAME} bisa diakses langsung dari browser di HP, tablet, laptop, atau PC kamu. Tidak ada aplikasi yang perlu diunduh.`,
  },
  {
    question: `Bagaimana cara menonton live streaming olahraga di ${SITE_NAME}?`,
    answer:
      'Klik menu "Live Sports" di navigasi atas untuk melihat jadwal dan siaran langsung pertandingan olahraga hari ini. Setiap pertandingan yang sedang berlangsung akan ditandai dengan badge merah "LIVE".',
  },
  {
    question: `Apakah ${SITE_NAME} bisa diakses di semua perangkat?`,
    answer:
      `Ya, ${SITE_NAME} dioptimalkan untuk semua perangkat termasuk smartphone Android, iPhone, tablet, laptop, dan desktop. Cukup buka browser dan akses ${SITE_DOMAIN}.`,
  },
  {
    question: 'Kenapa streaming buffering atau tidak bisa diputar?',
    answer:
      `${SITE_NAME} menggunakan teknologi adaptive streaming (DASH/HLS) yang menyesuaikan kualitas video dengan kecepatan internet kamu secara otomatis. Jika tetap buffering, coba refresh halaman atau periksa koneksi internet kamu.`,
  },
];

const pageJsonLd = buildJsonLd([
  buildWebPage({
    id: `${PAGE_URL}/#webpage`,
    url: PAGE_URL,
    name: `${SITE_NAME} - Nonton TV Live Streaming Online Gratis`,
    description:
      'Platform streaming TV live online gratis dengan ratusan channel Indonesia dan internasional.',
  }),
  buildWebApplication({
    name: `${SITE_NAME} TV Streaming`,
    description:
      'Tonton siaran TV live online gratis langsung dari browser. Mendukung berbagai format stream termasuk DASH dan HLS.',
    url: PAGE_URL,
  }),
  buildFAQPage(FAQ_ITEMS),
  buildWebSite(),
  buildOrganization(),
]);

function getHomeChannelData(): {
  channels: Channel[];
  movieChannels: Channel[];
  rightSidebarAd: RightSidebarAdSettings;
  topPlayerAd: AdSettings;
  topPlayerMobileFallbackAd: AdSettings;
} {
  const channels = sanitizeChannelsForClient(readChannelsData());
  const movieChannels = sanitizeChannelsForClient(readMovieChannelsData());
  const uiSettings = readPublicUiSettings();
  return {
    channels,
    movieChannels,
    rightSidebarAd: uiSettings.rightSidebarAd,
    topPlayerAd: uiSettings.topPlayerAd,
    topPlayerMobileFallbackAd: uiSettings.topPlayerMobileFallbackAd,
  };
}

export default function HomePage() {
  const {
    channels,
    movieChannels,
    rightSidebarAd,
    topPlayerAd,
    topPlayerMobileFallbackAd,
  } = getHomeChannelData();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#080a0f] text-gray-900 dark:text-white flex flex-col" style={undefined}>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pageJsonLd) }}
      />

      {/* Navbar */}
      <Navbar />

      {/* Main & SEO Content - SEO content passed as server-rendered children to Client Component */}
      <div className="flex-1 max-w-screen-2xl mx-auto w-full px-3 sm:px-4 py-4 sm:py-5">
        <HomeClient initialChannels={channels} initialRightSidebarAd={rightSidebarAd}>
          {/* SEO Content Section - server-rendered, min 500 words */}
          <section className="pb-16 lg:pb-12 mt-6 lg:mt-8">
            <div className="border-t border-white/5 pt-8 lg:pt-10 grid gap-5 sm:grid-cols-2">

              <div>
                <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 border-l-2 border-indigo-500 pl-3 mb-3">
                  Nonton TV Live Streaming Gratis
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                  {SITE_NAME} adalah platform streaming TV live online yang memungkinkan kamu menonton siaran langsung
                  dari ratusan channel TV Indonesia dan internasional secara gratis dan tanpa registrasi. Cukup buka
                  website, pilih channel, dan mulai menonton - semua langsung dari browser tanpa perlu mengunduh
                  aplikasi apapun.
                </p>
              </div>

              <div>
                <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 border-l-2 border-indigo-500 pl-3 mb-3">
                  Channel TV Indonesia Terlengkap
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                  Tersedia channel TV nasional Indonesia terlengkap seperti RCTI, SCTV, ANTV, Trans7, TransTV, Indosiar, MetroTV, CNN Indonesia, dan TVOne yang menghadirkan program unggulan. Semua channel dapat ditonton live streaming dengan kualitas jernih, stabil, tanpa buffering, kapan saja dan di mana saja melalui perangkat.
                </p>
              </div>

              <div>
                <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 border-l-2 border-indigo-500 pl-3 mb-3">
                  Channel Internasional & Olahraga
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                  Selain channel lokal, {SITE_NAME} juga menyediakan channel internasional berkualitas seperti BBC,
                  CNN, Al Jazeera, serta channel olahraga, berita, hiburan, dan anak-anak dari berbagai negara.
                  Nikmati konten global tanpa batas langsung dari Indonesia.
                </p>
              </div>

              <div>
                <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 border-l-2 border-indigo-500 pl-3 mb-3">
                  Live Streaming Olahraga
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                  Selain TV, {SITE_NAME} menyediakan halaman Live Sports khusus untuk siaran langsung pertandingan
                  olahraga. Mulai dari sepak bola, bulu tangkis, Formula 1, basket, tenis - semua
                  tersedia dengan jadwal real-time yang diperbarui setiap hari.
                </p>
              </div>
            </div>

            <PageTopDesktopAd
              ad={topPlayerAd}
              mobileAd={topPlayerMobileFallbackAd}
              fallbackAd={topPlayerAd}
              id="ad-slot-home-top-desktop"
              mobileId="ad-slot-home-top-mobile-inline"
              className="mt-6 lg:mt-8 mb-0"
            />

            <IndonesiaChannelsSection channels={channels} topSpacingClassName="mt-6" />
            <SportChannelsSection channels={channels} />
            <MovieChannelsSection channels={movieChannels} />

            {/* FAQ Section */}
            <div className="mt-10 border-t border-black/5 dark:border-white/5 pt-8">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-6">
                Pertanyaan yang Sering Ditanyakan (FAQ)
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {FAQ_ITEMS.map((faq, i) => (
                  <article key={i} className="bg-black/2 dark:bg-white/[0.03] border border-black/5 dark:border-white/5 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">{faq.question}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{faq.answer}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </HomeClient>
      </div>
    </div>
  );
}
