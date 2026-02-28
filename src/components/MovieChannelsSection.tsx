import Link from 'next/link';
import { watchUrl } from '@/lib/slug';
import type { Channel } from '@/types/channel';

const MAX_MOVIE_CHANNELS = 6;
const ALL_MOVIE_CHANNELS_URL = '/movie';

interface MovieChannelsSectionProps {
    channels: Channel[];
}

export default function MovieChannelsSection({ channels }: MovieChannelsSectionProps) {
    const movieChannels = [...channels].sort((a, b) => a.name.localeCompare(b.name, 'id-ID'));
    const featuredChannels = movieChannels.slice(0, MAX_MOVIE_CHANNELS);

    return (
        <div className="mt-10 border-t border-black/5 dark:border-white/5 pt-8">
            <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                    Channel Movie
                </h2>

                {movieChannels.length > 0 && (
                    <Link
                        href={ALL_MOVIE_CHANNELS_URL}
                        className="shrink-0 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                        Lihat semua channel movie
                    </Link>
                )}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
                Pilihan channel kategori movie yang bisa langsung kamu tonton.
            </p>

            {movieChannels.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">Belum ada channel movie yang tersedia.</p>
            )}

            {featuredChannels.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {featuredChannels.map((channel) => (
                        <Link
                            key={channel.id}
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
                                            width="40"
                                            height="40"
                                        />
                                    ) : (
                                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                                            {channel.name.slice(0, 1).toUpperCase()}
                                        </span>
                                    )}
                                </div>

                                <div className="min-w-0">
                                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                                        {channel.name}
                                    </h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                        {channel.tagline || 'Movie'}
                                    </p>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
