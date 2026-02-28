'use client';

import { useState, useEffect } from 'react';
import RightSidebarAdSlot from '@/components/RightSidebarAdSlot';
import { AdSettings, normalizeAdSettings } from '@/lib/right-sidebar-ad';
import styles from '@/components/PageTopDesktopAd.module.css';

interface PageTopDesktopAdProps {
    ad?: Partial<AdSettings>;
    mobileAd?: Partial<AdSettings>;
    fallbackAd?: Partial<AdSettings>;
    id?: string;
    mobileId?: string;
    className?: string;
}

function hasRenderableAd(ad: AdSettings): boolean {
    if (!ad.enabled) return false;
    if (ad.type === 'script') return ad.script.trim().length > 0;
    if (ad.type === 'iframe') return ad.iframeUrl.trim().length > 0;
    return ad.imageUrl.trim().length > 0;
}

export default function PageTopDesktopAd({
    ad,
    mobileAd,
    fallbackAd,
    id = 'ad-slot-page-top-desktop',
    mobileId = 'ad-slot-page-top-mobile-inline',
    className = 'mb-6',
}: PageTopDesktopAdProps) {
    const [isMobile, setIsMobile] = useState<boolean | null>(null);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const normalizedDesktopAd = normalizeAdSettings(ad);
    const normalizedMobileAd = normalizeAdSettings(mobileAd);
    const normalizedFallbackAd = normalizeAdSettings(fallbackAd);

    const hasDesktopAd = hasRenderableAd(normalizedDesktopAd);
    const hasMobileAd = hasRenderableAd(normalizedMobileAd);
    const hasFallback = hasRenderableAd(normalizedFallbackAd);

    const desktopShowAd = hasDesktopAd ? normalizedDesktopAd : (hasFallback ? normalizedFallbackAd : null);
    const mobileShowAd = hasMobileAd ? normalizedMobileAd : (hasFallback ? normalizedFallbackAd : null);

    if (isMobile === null) {
        return <div className={className} />;
    }

    return (
        <div className={className}>
            {isMobile ? (
                mobileShowAd && (
                    <div className="flex justify-center">
                        <RightSidebarAdSlot
                            ad={mobileShowAd}
                            id={mobileId}
                            iframeTitle="Page Top Mobile Inline Ad"
                            scriptRenderMode="iframe"
                            placeholderLabel="Ad Slot 300x250"
                            placeholderHint="Inline mobile ads"
                            className={`${styles.mobileSlot} mx-auto bg-gray-100 dark:bg-[#0f1117] border border-black/8 dark:border-white/5 rounded-lg flex flex-col items-center justify-center gap-2 overflow-hidden relative`}
                        />
                    </div>
                )
            ) : (
                desktopShowAd && (
                    <div className="flex justify-center">
                        <RightSidebarAdSlot
                            ad={desktopShowAd}
                            id={id}
                            iframeTitle="Page Top Ad 728x90"
                            scriptRenderMode="iframe"
                            placeholderLabel="Ad Slot 728x90 / 970x90 / 970x250"
                            className={`${styles.desktopSlot} mx-auto bg-gray-100 dark:bg-[#0f1117] border border-black/8 dark:border-white/5 rounded-lg flex flex-col items-center justify-center gap-2 overflow-hidden relative`}
                        />
                    </div>
                )
            )}
        </div>
    );
}
