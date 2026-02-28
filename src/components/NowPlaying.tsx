'use client';

import Image from 'next/image';
import { Channel } from '@/types/channel';
import { Globe, Signal, Film } from 'lucide-react';

interface NowPlayingProps {
    channel: Channel | null;
}

export default function NowPlaying({ channel }: NowPlayingProps) {
    if (!channel) return null;

    const streamTypeLabel: Record<string, string> = {
        'dash-clearkey': 'DASH ClearKey',
        'hls': 'HLS',
        'dash': 'MPEG-DASH',
        'mp4': 'MP4',
    };

    return (
        <div className="bg-white dark:bg-[#0f1117] border border-black/8 dark:border-white/5 rounded-xl p-4">
            <div className="flex items-start gap-4">
                {/* Channel Logo */}
                <div className="relative w-14 h-14 flex-shrink-0 overflow-hidden rounded-sm">
                    {channel.image ? (
                        <Image
                            src={channel.image}
                            alt={channel.name}
                            fill
                            className="object-contain"
                            unoptimized
                        />
                    ) : (
                        <Film className="w-7 h-7 text-gray-400 dark:text-gray-500" />
                    )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 py-2">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h2 className="text-gray-900 dark:text-white font-bold text-lg leading-tight">{channel.name}</h2>
                        {channel.premium === 't' && (
                            <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-500 dark:text-amber-400">
                                PREMIUM
                            </span>
                        )}
                        {channel.is_live === 't' && (
                            <span className="flex items-center gap-1 text-[10px] bg-red-500/20 text-red-500 dark:text-red-400 px-2 py-0.5 rounded-full font-medium animate-pulse">
                                <Signal className="w-2.5 h-2.5" /> LIVE
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                            <Globe className="w-3 h-3" /> {channel.country_name}
                        </span>
                        <span className="text-xs text-gray-300 dark:text-gray-600">|</span>
                        <span className="text-xs text-indigo-500 dark:text-indigo-400 font-mono">
                            {streamTypeLabel[channel.jenis] || channel.jenis}
                        </span>
                        {channel.category && (
                            <>
                                <span className="text-xs text-gray-300 dark:text-gray-600">|</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">{channel.category}</span>
                            </>
                        )}
                    </div>
                </div>

                {/* Tagline */}
                {channel.tagline && (
                    <div className="hidden sm:block text-right">
                        <p className="text-indigo-500 dark:text-indigo-400 text-sm font-medium leading-tight">
                            {channel.tagline}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
