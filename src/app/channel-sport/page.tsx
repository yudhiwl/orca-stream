import type { Metadata } from 'next';
import Link from 'next/link';
import fs from 'fs';
import path from 'path';
import { ChevronRight } from 'lucide-react';
import Navbar from '@/components/Navbar';
import PageTopDesktopAd from '@/components/PageTopDesktopAd';
import RightSidebarAdSlot from '@/components/RightSidebarAdSlot';
import DesktopSidebarFlexibleAd from '@/components/DesktopSidebarFlexibleAd';
import SidebarInfoCard from '@/components/SidebarInfoCard';
import { watchUrl } from '@/lib/slug';
import type { Channel } from '@/types/channel';
import { buildWebPage, buildWebApplication, buildJsonLd, buildWebSite, buildOrganization, SITE_URL } from '@/lib/schema';
import { SITE_NAME } from '@/lib/site-config';
import { readPublicUiSettings } from '@/lib/ui-settings-public';

const CHANNELS_FILE = path.join(process.cwd(), 'src', 'data', 'channels.json');

const PAGE_URL = `${SITE_URL}/channel-sport`;
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Channel Sport',
  description:
    `Daftar lengkap channel kategori sport di ${SITE_NAME}. Pilih channel favorit kamu dan tonton live streaming gratis.`,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    siteName: SITE_NAME,
    locale: 'id_ID',
    title: `Channel Sport | ${SITE_NAME}`,
    description: `Daftar lengkap channel kategori sport di ${SITE_NAME}. Tonton live streaming olahraga gratis.`,
    url: PAGE_URL,
    type: 'website',
  },
  twitter: {
    title: `Channel Sport | ${SITE_NAME}`,
    description: `Tonton live streaming channel olahraga gratis di ${SITE_NAME}.`,
  },
};

function readChannels(): Channel[] {
  try {
    const raw = fs.readFileSync(CHANNELS_FILE, 'utf-8').replace(/^\uFEFF/, '').trim();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Channel[]) : [];
  } catch {
    return [];
  }
}

function isSportChannel(channel: Channel): boolean {
  const category = (channel.category || '').trim().toLowerCase();
  return category.includes('sport');
}

export default function SportChannelsPage() {
  const sportChannels = readChannels()
    .filter(isSportChannel)
    .sort((a, b) => a.name.localeCompare(b.name, 'id-ID'));
  const uiSettings = readPublicUiSettings();
  const showGridAd = uiSettings.rightSidebarAd.enabled;
  const gridAdInsertIndex = sportChannels.length >= 18 ? Math.floor(sportChannels.length / 2) : -1;

  const pageJsonLd = buildJsonLd([
    buildWebPage({
      id: `${PAGE_URL}#webpage`,
      url: PAGE_URL,
      name: `Channel Sport | ${SITE_NAME}`,
      description:
        `Daftar lengkap channel kategori sport di ${SITE_NAME}. Pilih channel favorit kamu dan tonton live streaming olahraga gratis.`,
      breadcrumb: [
        { name: 'Beranda', url: SITE_URL },
        { name: 'Channel Sport', url: PAGE_URL },
      ],
    }),
    buildWebApplication({
      name: `${SITE_NAME} Channel Sport`,
      description: `Tonton live streaming channel sport gratis di ${SITE_NAME}.`,
      url: PAGE_URL,
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
      <Navbar />

      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 py-8">
        <nav className="mb-6" aria-label="Breadcrumb">
          <ol
            className="flex items-center gap-1.5 text-sm font-medium text-gray-500 list-none"
            itemScope
            itemType="https://schema.org/BreadcrumbList"
          >
            <li
              className="flex items-center"
              itemProp="itemListElement"
              itemScope
              itemType="https://schema.org/ListItem"
            >
              <Link
                href="/"
                className="text-gray-600 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-gray-300 transition-colors"
                itemProp="item"
              >
                <span itemProp="name">Beranda</span>
              </Link>
              <meta itemProp="position" content="1" />
              <span aria-hidden="true" className="ml-1.5 flex items-center text-gray-400 dark:text-gray-700">
                <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </li>
            <li
              className="flex items-center"
              itemProp="itemListElement"
              itemScope
              itemType="https://schema.org/ListItem"
            >
              <span className="text-gray-400 dark:text-gray-300" itemProp="name">Channel Sport</span>
              <meta itemProp="position" content="2" />
            </li>
          </ol>
        </nav>

        <PageTopDesktopAd
          ad={uiSettings.topPlayerAd}
          mobileAd={uiSettings.topPlayerMobileFallbackAd}
          fallbackAd={uiSettings.topPlayerAd}
          id="ad-slot-channel-sport-top-desktop"
          mobileId="ad-slot-channel-sport-top-mobile-inline"
        />

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 min-w-0">
            <section className="bg-white dark:bg-[#0f1117] border border-black/8 dark:border-white/5 rounded-2xl p-5 sm:p-6">
              <div className="mb-5">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  Semua Channel Kategori Sport
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Total {sportChannels.length} channel sport tersedia.
                </p>
              </div>

              {sportChannels.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Belum ada channel sport yang tersedia.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {sportChannels.map((channel, index) => (
                    <div key={channel.id} className="contents">
                      {showGridAd && index === gridAdInsertIndex && (
                        <div className="sm:col-span-2 xl:col-span-3 py-2">
                          <div className="bg-gray-50 dark:bg-white/5 border border-dashed border-black/10 dark:border-white/10 rounded-xl p-4 flex flex-col items-center justify-center min-h-[100px]">
                            <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-2 font-medium">Advertisement</p>
                            <div className="w-full flex justify-center">
                              <RightSidebarAdSlot
                                ad={uiSettings.rightSidebarAd}
                                id={`ad-slot-grid-sport-${index}`}
                                iframeTitle={`Grid Ad ${index}`}
                                className="w-full max-w-[728px] h-[90px] bg-transparent border-0 rounded-none shadow-none"
                                compactPlaceholder
                                placeholderLabel="Grid Ad 728x90"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                      <Link
                        href={watchUrl(channel.id, channel.name)}
                        className="group relative rounded-xl border border-black/8 dark:border-white/10 bg-white/80 dark:bg-white/[0.02] p-3 hover:border-indigo-500/60 transition-colors"
                      >
                        {channel.premium === 't' && (
                          <span className="absolute right-0 top-0 inline-flex items-center gap-1 rounded-full px-0 py-0 text-[8px] font-medium text-yellow-600 dark:text-yellow-400">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src="/icons/premium.svg"
                              alt="Premium Badge"
                              width={60}
                              height={22}
                              loading="lazy"
                            />
                          </span>
                        )}
                        <div className="flex items-center gap-2">
                          <div className="h-11 w-16 rounded-lg bg-gray-100 dark:bg-white/5 border border-black/5 dark:border-white/10 overflow-hidden flex items-center justify-center">
                            {channel.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={channel.image}
                                alt={channel.name}
                                className="h-full w-full object-cover"
                                loading="lazy"
                                width="64"
                                height="44"
                              />
                            ) : (
                              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                                {channel.name.slice(0, 1).toUpperCase()}
                              </span>
                            )}
                          </div>

                          <div className="min-w-0">
                            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                              {channel.name}
                            </h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {channel.category || 'Sports'}
                            </p>
                          </div>
                        </div>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="hidden lg:block w-[320px] flex-shrink-0">
            <div className="sticky top-20 flex flex-col gap-5">
              <DesktopSidebarFlexibleAd
                ad={uiSettings.rightSidebarAd}
                id="ad-slot-channel-sport-sidebar"
                iframeTitle="Sidebar Ad 300x600"
                placeholderLabel="Sidebar Ad 300x250 / 300x600"
              />
              <SidebarInfoCard />
            </div>
          </aside>
        </div>
      </main>
    </div >
  );
}
