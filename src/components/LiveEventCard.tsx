import { LiveEvent } from '@/types/live-event';
import { Radio, Clock, Trophy } from 'lucide-react';

interface LiveEventCardProps {
    event: LiveEvent;
    onClick: (event: LiveEvent) => void;
}

const SPORT_COLORS: Record<string, string> = {
    'Sepak Bola': 'text-green-600 dark:text-green-400 bg-green-500/10',
    'Bulu Tangkis': 'text-yellow-600 dark:text-yellow-400 bg-yellow-500/10',
    'Formula 1': 'text-red-600 dark:text-red-400 bg-red-500/10',
    'Basket': 'text-orange-600 dark:text-orange-400 bg-orange-500/10',
    'Tenis': 'text-lime-600 dark:text-lime-400 bg-lime-500/10',
    'Voli': 'text-blue-600 dark:text-blue-400 bg-blue-500/10',
    'MMA': 'text-purple-600 dark:text-purple-400 bg-purple-500/10',
};

function formatMatchTime(unixSeconds: string): string {
    if (!unixSeconds || unixSeconds === '' || unixSeconds === 'none') return '';
    try {
        const seconds = Number(unixSeconds);
        if (!Number.isFinite(seconds)) return '';
        return new Date(seconds * 1000).toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Jakarta',
        });
    } catch {
        return '';
    }
}

export default function LiveEventCard({ event, onClick }: LiveEventCardProps) {
    const sportColor = SPORT_COLORS[event.sport] || 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10';
    const matchTime = formatMatchTime(event.t_stamp);

    return (
        <button
            onClick={() => onClick(event)}
            className="group relative w-full text-left rounded-xl border border-black/8 dark:border-white/10 bg-white/80 dark:bg-white/[0.02] p-3 hover:border-indigo-500/60 transition-colors"
        >
            <div className="flex items-start gap-3">
                <div className="h-11 w-16 rounded-lg bg-gray-100 dark:bg-white/5 border border-black/5 dark:border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {event.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={event.thumbnail}
                            alt={event.title}
                            className="h-full w-full object-cover"
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                        />
                    ) : (
                        <Trophy className="w-4 h-4 text-gray-400 dark:text-gray-600" />
                    )}
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                    <div className="min-w-0">
                        <h2 className="text-xs font-semibold text-gray-800 dark:text-gray-200 leading-snug line-clamp-2">
                            {event.title}
                        </h2>
                    </div>

                    {event.competition && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {event.competition}
                        </p>
                    )}

                    <div className="flex items-center gap-2 text-[11px] flex-wrap">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${sportColor}`}>
                            {event.sport}
                        </span>
                        {event.is_live === 't' && (
                            <span className="inline-flex items-center gap-1 text-red-500 dark:text-red-400 font-semibold">
                                <Radio className="w-3 h-3 animate-pulse" />
                                LIVE
                            </span>
                        )}
                        {matchTime && (
                            <span className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-300">
                                <Clock className="w-3 h-3" />
                                {matchTime} WIB
                            </span>
                        )}
                        {!matchTime && event.is_live !== 't' && (
                            <span className="text-gray-500 dark:text-gray-400">Jadwal belum tersedia</span>
                        )}
                    </div>
                </div>
            </div>
        </button>
    );
}
