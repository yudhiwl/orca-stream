'use client';

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextValue {
    theme: Theme;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
    theme: 'dark',
    toggleTheme: () => { },
});

export function useTheme() {
    return useContext(ThemeContext);
}

interface ThemeProviderProps {
    children: ReactNode;
    initialTheme?: Theme;
}

export default function ThemeProvider({ children, initialTheme = 'dark' }: ThemeProviderProps) {
    const [theme, setTheme] = useState<Theme>(initialTheme);

    const applyTheme = useCallback((nextTheme: Theme) => {
        const root = document.documentElement;
        if (nextTheme === 'dark') {
            root.classList.add('dark');
            root.classList.remove('light');
        } else {
            root.classList.remove('dark');
            root.classList.add('light');
        }
    }, []);

    useEffect(() => {
        applyTheme(theme);
    }, [applyTheme, theme]);

    useEffect(() => {
        const stored = localStorage.getItem('theme');
        const cookieTheme = document.cookie.match(/(?:^|; )theme=(dark|light)/)?.[1];
        const resolved: Theme =
            stored === 'dark' || stored === 'light'
                ? stored
                : cookieTheme === 'dark' || cookieTheme === 'light'
                    ? cookieTheme
                    : initialTheme;

        if (resolved !== theme) {
            setTheme(resolved);
            applyTheme(resolved);
        }
    }, [applyTheme, initialTheme, theme]);

    const toggleTheme = useCallback(() => {
        setTheme((prev) => {
            const next: Theme = prev === 'dark' ? 'light' : 'dark';
            localStorage.setItem('theme', next);
            document.cookie = `theme=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
            applyTheme(next);
            return next;
        });
    }, [applyTheme]);

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}
