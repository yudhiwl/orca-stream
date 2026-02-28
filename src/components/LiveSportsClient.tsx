'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LiveEvent } from '@/types/live-event';
import LiveEventCard from '@/components/LiveEventCard';
import { watchUrl } from '@/lib/slug';
import { toLiveEventWatchId } from '@/lib/live-event-id';

const SPORT_FILTERS = ['Semua', 'Sepak Bola', 'Bulu Tangkis', 'Formula 1', 'Basket', 'Tenis', 'Voli', 'MMA'];

interface LiveSportsClientProps {
    events: LiveEvent[];
}

export default function LiveSportsClient({ events }: LiveSportsClientProps) {
    const router = useRouter();
    const [activeSport, setActiveSport] = useState('Semua');

    // Filter only by sport — is_live filtering already done server-side
    const filtered = events.filter(e =>
        activeSport === 'Semua' || e.sport === activeSport
    );

    // Determine which sport filters have events
    const availableSports = ['Semua', ...Array.from(new Set(events.map(e => e.sport))).sort()];
    const filters = SPORT_FILTERS.filter(s => availableSports.includes(s));

    const handleSelect = (event: LiveEvent) => {
        // Navigate to /watch with event ID and slug
        router.push(watchUrl(toLiveEventWatchId(event.id), event.title));
    };

    if (events.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="text-5xl mb-4">⚽</div>
                <p className="text-gray-400 dark:text-gray-500 font-medium">Belum ada event live atau jadwal terdekat</p>
                <p className="text-gray-600 dark:text-gray-600 text-sm mt-2">
                    Pantau terus halaman ini untuk jadwal pertandingan berikutnya
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Sport Filter Tabs */}
            <div className="flex gap-2 flex-wrap">
                {filters.map(sport => (
                    <button
                        key={sport}
                        onClick={() => setActiveSport(sport)}
                        className={`text-sm px-3 py-1.5 rounded-full transition-all ${activeSport === sport
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-black/5 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-black/10 dark:hover:bg-white/10'
                            }`}
                    >
                        {sport}
                    </button>
                ))}
            </div>

            {/* Event Grid */}
            {filtered.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-600 text-sm text-center py-8">
                    Tidak ada event live/jadwal untuk kategori ini
                </p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {filtered.map(event => (
                        <LiveEventCard
                            key={event.id}
                            event={event}
                            onClick={handleSelect}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
