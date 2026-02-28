'use client';

import { useEffect, useState } from 'react';
import {
    DEFAULT_RIGHT_SIDEBAR_AD,
    RightSidebarAdSettings,
    normalizeRightSidebarAdSettings,
} from '@/lib/right-sidebar-ad';

export function useRightSidebarAdSettings() {
    const [rightSidebarAd, setRightSidebarAd] = useState<RightSidebarAdSettings>(
        DEFAULT_RIGHT_SIDEBAR_AD
    );

    useEffect(() => {
        let cancelled = false;

        const loadUiSettings = async () => {
            try {
                const res = await fetch('/api/v1/ui-settings', { cache: 'no-store' });
                if (!res.ok) return;

                const data = (await res.json()) as {
                    rightSidebarAd?: Partial<RightSidebarAdSettings>;
                };
                if (cancelled) return;
                setRightSidebarAd(normalizeRightSidebarAdSettings(data.rightSidebarAd));
            } catch {
                // keep default placeholder
            }
        };

        void loadUiSettings();
        return () => {
            cancelled = true;
        };
    }, []);

    return rightSidebarAd;
}
