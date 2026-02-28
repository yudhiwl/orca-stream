'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { Channel } from '@/types/channel';
import { Tv, Radio, Globe } from 'lucide-react';

interface ChannelListProps {
    channels: Channel[];
    activeChannel: Channel | null;
    onSelect: (channel: Channel) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
    Sports: 'bg-green-500/20 text-green-600 dark:text-green-400',
    News: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
    Entertainment: 'bg-purple-500/20 text-purple-600 dark:text-purple-400',
    Kids: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400',
    Movies: 'bg-red-500/20 text-red-600 dark:text-red-400',
    Music: 'bg-pink-500/20 text-pink-600 dark:text-pink-400',
    Documentary: 'bg-teal-500/20 text-teal-600 dark:text-teal-400',
    General: 'bg-gray-500/20 text-gray-600 dark:text-gray-400',
};

export default function ChannelList({ channels, activeChannel, onSelect }: ChannelListProps) {
    const activeCountryCode = activeChannel?.alpha_2_code?.trim() || '';
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [countryFilter, setCountryFilter] = useState(() => activeCountryCode || 'All');

    // Derive unique categories and countries from channels
    const categories = ['All', ...Array.from(new Set(channels.map(c => c.category).filter((cat): cat is string => !!cat)))].slice(0, 9);
    const countries = useMemo(() => {
        const codes = Array.from(new Set(channels.map(c => c.alpha_2_code).filter((cnt): cnt is string => !!cnt)));
        if (activeCountryCode && !codes.includes(activeCountryCode)) {
            codes.unshift(activeCountryCode);
        }
        return ['All', ...codes].slice(0, 8);
    }, [channels, activeCountryCode]);

    const filtered = channels.filter(c => {
        const catOk = categoryFilter === 'All' || c.category === categoryFilter;
        const cntOk = countryFilter === 'All' || c.alpha_2_code === countryFilter;
        return catOk && cntOk;
    });

    const hasCountryFilter = countries.length > 2;

    return (
        <div className="flex flex-col h-full bg-white dark:bg-[#0f1117] border border-black/8 dark:border-white/5 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="px-4 pt-4 pb-3 border-b border-black/8 dark:border-white/5 space-y-3">
                <div className="flex items-center gap-2">
                    <Tv className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                    <h2 className="font-semibold text-sm text-gray-800 dark:text-white">Channel List</h2>
                    <span className="ml-auto text-xs text-gray-500 dark:text-gray-500 bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded-full">
                        {filtered.length}/{channels.length}
                    </span>
                </div>

                {/* Category filter */}
                <div className="flex flex-wrap gap-1">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setCategoryFilter(cat)}
                            className={`text-[10px] font-medium px-2 py-0.5 rounded-full transition-colors ${categoryFilter === cat
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Country filter */}
                {hasCountryFilter && (
                    <div className="flex items-center gap-1 flex-wrap">
                        <Globe className="w-3 h-3 text-gray-400 dark:text-gray-600" />
                        {countries.map(c => (
                            <button
                                key={c}
                                onClick={() => setCountryFilter(c)}
                                className={`text-[10px] font-medium px-2 py-0.5 rounded-full transition-colors ${countryFilter === c
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-white/10'
                                    }`}
                            >
                                {c === 'All' ? 'All' : c}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Channel list */}
            <div className="flex-1 overflow-y-auto scrollbar-thin">
                {filtered.length === 0 ? (
                    <div className="flex items-center justify-center h-20 text-xs text-gray-400 dark:text-gray-600">
                        No channels found
                    </div>
                ) : (
                    <ul>
                        {filtered.map(channel => {
                            const isActive = activeChannel?.id === channel.id;
                            const categoryKey = channel.category || 'General';
                            const catColor = CATEGORY_COLORS[categoryKey] || CATEGORY_COLORS.General;

                            return (
                                <li key={channel.id}>
                                    <button
                                        onClick={() => onSelect(channel)}
                                        className={`w-full flex items-center gap-2 px-1 py-2.5 text-left transition-all duration-200 ${isActive
                                            ? 'bg-indigo-50 dark:bg-indigo-500/15 border-l-4 border-indigo-500 shadow-[inset_1px_0_0_0_#6366f1]'
                                            : 'hover:bg-gray-100 dark:hover:bg-white/5 border-l-4 border-transparent'
                                            }`}
                                    >
                                        {/* Channel logo */}
                                        <div className="relative h-8 w-12 rounded-lg bg-gray-100 dark:bg-white/10 flex-shrink-0 overflow-hidden flex items-center justify-center">
                                            {channel.image ? (
                                                <Image
                                                    src={channel.image}
                                                    alt={channel.name}
                                                    fill
                                                    unoptimized
                                                    sizes="48px"
                                                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                                                />
                                            ) : (
                                                <Radio className="w-4 h-4 text-gray-400 dark:text-gray-600" />
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-xs font-medium truncate ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-800 dark:text-gray-200'
                                                }`}>
                                                {channel.name}
                                            </p>
                                            <p className="text-[10px] text-gray-400 dark:text-gray-600 truncate">
                                                {channel.country_name || channel.alpha_2_code}
                                            </p>
                                        </div>

                                        {/* Category badge */}
                                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${catColor}`}>
                                            {channel.category?.slice(0, 10)}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}
