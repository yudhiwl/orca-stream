'use client';

import Image from 'next/image';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Tv2, Menu, X, Sun, Moon, Dumbbell, Flag, Film, Home } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { SITE_NAME } from '@/lib/site-config';

interface NavbarProps {
    badge?: React.ReactNode;
}

export default function Navbar({ badge }: NavbarProps) {
    const pathname = usePathname();
    const [menuOpen, setMenuOpen] = useState(false);
    const { theme, toggleTheme } = useTheme();

    const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

    return (
        <header className="sticky top-0 z-50 border-b border-black/8 dark:border-white/5 bg-white/90 dark:bg-[#080a0f]/90 backdrop-blur-md relative">
            <div className="max-w-screen-2xl mx-auto px-4 h-14 flex items-center gap-3">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2 flex-shrink-0" onClick={() => setMenuOpen(false)}>
                    <Image src="/icons/logo.svg" alt={`${SITE_NAME} Logo`} className="w-8 h-8" width={32} height={32} priority />

                    <span className="font-bold text-base tracking-tight text-gray-900 dark:text-white">
                        {SITE_NAME}
                    </span>
                </Link>

                {/* Desktop nav links — pushed to the right */}
                <nav className="hidden sm:flex items-center gap-1 ml-auto text-sm font-medium">
                    <Link
                        href="/"
                        className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${pathname === '/'
                            ? 'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
                            }`}
                    >
                        <Home className="w-3.5 h-3.5" />
                        Home
                    </Link>
                    <Link
                        href="/channel-indonesia"
                        className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${isActive('/channel-indonesia')
                            ? 'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
                            }`}
                    >
                        <Flag className="w-3.5 h-3.5" />
                        Indonesia
                    </Link>
                    <Link
                        href="/movie"
                        className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${isActive('/movie')
                            ? 'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
                            }`}
                    >
                        <Film className="w-3.5 h-3.5" />
                        Movie
                    </Link>
                    <Link
                        href="/channel-sport"
                        className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${isActive('/channel-sport')
                            ? 'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
                            }`}
                    >
                        <Dumbbell className="w-3.5 h-3.5" />
                        Sport
                    </Link>
                    <Link
                        href="/live-sports"
                        className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${isActive('/live-sports')
                            ? 'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
                            }`}
                    >
                        <span className="relative flex h-2 w-2 flex-shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                        </span>
                        Live Sports
                    </Link>
                </nav>

                {/* Theme toggle + Badge (desktop) */}
                <div className="hidden sm:flex items-center gap-2 ml-3">
                    {badge}
                    <button
                        onClick={toggleTheme}
                        className="p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                    >
                        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </button>
                </div>

                {/* Mobile: badge + theme toggle + hamburger */}
                <div className="ml-auto flex sm:hidden items-center gap-1">
                    {badge}
                    <button
                        onClick={toggleTheme}
                        className="p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                    >
                        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </button>
                    <button
                        className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                        onClick={() => setMenuOpen(v => !v)}
                        aria-label="Toggle menu"
                    >
                        {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            {/* Mobile dropdown — absolute overlay */}
            {menuOpen && (
                <nav className="sm:hidden absolute top-full left-0 right-0 z-50 border-b border-black/8 dark:border-white/5 bg-white/95 dark:bg-[#080a0f]/95 backdrop-blur-md px-4 py-3 flex flex-col gap-1 shadow-xl">
                    <Link
                        href="/"
                        onClick={() => setMenuOpen(false)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${pathname === '/'
                            ? 'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5'
                            }`}
                    >
                        <Tv2 className="w-4 h-4" />
                        TV Channels
                    </Link>
                    <Link
                        href="/channel-indonesia"
                        onClick={() => setMenuOpen(false)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive('/channel-indonesia')
                            ? 'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5'
                            }`}
                    >
                        <Flag className="w-4 h-4" />
                        Indonesia
                    </Link>
                    <Link
                        href="/movie"
                        onClick={() => setMenuOpen(false)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive('/movie')
                            ? 'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5'
                            }`}
                    >
                        <Film className="w-4 h-4" />
                        Movie
                    </Link>
                    <Link
                        href="/channel-sport"
                        onClick={() => setMenuOpen(false)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive('/channel-sport')
                            ? 'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5'
                            }`}
                    >
                        <Dumbbell className="w-4 h-4" />
                        Channel Sport
                    </Link>
                    <Link
                        href="/live-sports"
                        onClick={() => setMenuOpen(false)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive('/live-sports')
                            ? 'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5'
                            }`}
                    >
                        <span className="relative flex h-2 w-2 flex-shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                        </span>
                        Live Sports
                    </Link>
                </nav>
            )}
        </header>
    );
}
