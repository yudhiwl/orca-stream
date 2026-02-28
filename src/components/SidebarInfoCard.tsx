import Link from 'next/link';
import { SITE_NAME } from '@/lib/site-config';

interface SidebarInfoCardProps {
    className?: string;
}

export default function SidebarInfoCard({ className = '' }: SidebarInfoCardProps) {
    const containerClassName = ['bg-white dark:bg-[#0f1117] border border-black/8 dark:border-white/5 rounded-xl p-4', className]
        .filter(Boolean)
        .join(' ');

    return (
        <div className={containerClassName}>
            <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Informasi</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <Link href="/about" className="text-xs text-gray-600 dark:text-gray-400 hover:text-indigo-500 transition-colors">Tentang Kami</Link>
                <Link href="/contact" className="text-xs text-gray-600 dark:text-gray-400 hover:text-indigo-500 transition-colors">Kontak</Link>
                <Link href="/privacy" className="text-xs text-gray-600 dark:text-gray-400 hover:text-indigo-500 transition-colors">Privasi</Link>
                <Link href="/terms" className="text-xs text-gray-600 dark:text-gray-400 hover:text-indigo-500 transition-colors">Ketentuan</Link>
                <Link href="/disclaimer" className="text-xs text-gray-600 dark:text-gray-400 hover:text-indigo-500 transition-colors col-span-2">Disclaimer</Link>
            </div>
            <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/5">
                <p className="text-[10px] text-gray-400 dark:text-gray-600 leading-tight">
                    {`© 2026 ${SITE_NAME}. Semua siaran adalah milik pemegang hak cipta masing-masing.`}
                </p>
            </div>
        </div>
    );
}
