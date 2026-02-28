'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Channel } from '@/types/channel';
import ChannelList from '@/components/ChannelList';
import DesktopSidebarFlexibleAd from '@/components/DesktopSidebarFlexibleAd';
import SidebarInfoCard from '@/components/SidebarInfoCard';
import { Search, Menu, X } from 'lucide-react';
import { watchUrl } from '@/lib/slug';
import { RightSidebarAdSettings, normalizeRightSidebarAdSettings } from '@/lib/right-sidebar-ad';

interface HomeClientProps {
    initialChannels: Channel[];
    initialRightSidebarAd?: Partial<RightSidebarAdSettings>;
    children?: React.ReactNode;
}

export default function HomeClient({ initialChannels, initialRightSidebarAd, children }: HomeClientProps) {
    const router = useRouter();
    const [search, setSearch] = useState('');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
    const rightSidebarAd = normalizeRightSidebarAdSettings(initialRightSidebarAd);
    const channels = initialChannels;
    const channelsLoading = false;

    const handleSelect = (channel: Channel) => {
        setSidebarOpen(false);
        router.push(watchUrl(channel.id, channel.name));
    };

    const filtered = channels.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.namespace?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="flex gap-4 relative">
            {/* Mobile overlay backdrop */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-20 bg-black/60 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Left Sidebar */}
            <aside
                className={[
                    'fixed top-[3.5rem] left-0 z-30 h-[calc(100vh-3.5rem)] w-72 bg-gray-50 dark:bg-[#080a0f]',
                    'transition-transform duration-300 ease-in-out',
                    sidebarOpen ? 'translate-x-0' : '-translate-x-full',
                    'lg:static lg:translate-x-0 lg:z-auto lg:h-[calc(100vh-5.25rem)]',
                    'lg:sticky lg:top-14 lg:w-64 lg:flex-shrink-0',
                ].join(' ')}
            >
                {/* Search */}
                <div className="relative mb-3 px-1 pt-1 lg:px-0 lg:pt-0" style={{ position: 'sticky', top: '4rem', height: 'fit-content' }}>
                    <Search className="absolute left-4 lg:left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5" />
                    <input
                        type="text"
                        placeholder="Cari channel..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-white dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg pl-9 pr-10 py-2 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-all focus:shadow-[0_0_0_2px_rgba(99,102,241,0.2)]"
                    />
                    {search.trim().length > 0 && (
                        <button
                            type="button"
                            onClick={() => setSearch('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 hover:text-gray-200 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
                            aria-label="Hapus teks pencarian"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
                <div className="h-[calc(100%-3rem)]">
                    <ChannelList
                        channels={filtered}
                        activeChannel={activeChannel}
                        onSelect={channel => {
                            setActiveChannel(channel);
                            handleSelect(channel);
                        }}
                    />
                </div>
            </aside>

            {/* Mobile FAB: toggle sidebar */}
            <button
                className="lg:hidden fixed bottom-5 left-4 z-40 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-lg shadow-indigo-500/30 transition-all"
                onClick={() => setSidebarOpen(v => !v)}
                aria-label="Toggle channel list"
            >
                {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                <span>{sidebarOpen ? 'Tutup' : 'Channel List'}</span>
            </button>

            {/* Center: SEO content */}
            <main className="flex-1 min-w-0 flex flex-col gap-4 pb-16 lg:pb-6" id="main-content">
                {!channelsLoading && channels.length === 0 && (
                    <a
                        href="/admin"
                        className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-colors w-fit"
                    >
                        Tambah Channel Pertama &rarr;
                    </a>
                )}
                <article className="space-y-4 px-1">
                    {children}
                </article>
            </main>

            <aside
                className="fixed top-[3.5rem] hidden lg:flex w-[320px] flex-shrink-0 flex-col gap-3"
                style={{ position: 'sticky', top: '4rem', height: 'fit-content' }}
            >
                <div className="flex flex-col gap-2">
                    {/* <p className="text-[10px] text-gray-400 dark:text-gray-600 uppercase tracking-widest text-center">Advertisement</p> */}
                    <DesktopSidebarFlexibleAd
                        ad={rightSidebarAd}
                        id="ad-slot-home-sidebar"
                        iframeTitle="Homepage Sidebar Ad iFrame"
                    />
                </div>

                <SidebarInfoCard />
            </aside>
        </div>
    );
}
