import RightSidebarAdSlot from '@/components/RightSidebarAdSlot';
import { AdSettings, normalizeAdSettings } from '@/lib/right-sidebar-ad';

interface MobileStickyFooterAdProps {
    primaryAd?: Partial<AdSettings>;
    fallbackAd?: Partial<AdSettings>;
    id?: string;
}

function hasRenderableAd(ad: AdSettings): boolean {
    if (!ad.enabled) return false;
    if (ad.type === 'script') return ad.script.trim().length > 0;
    if (ad.type === 'iframe') return ad.iframeUrl.trim().length > 0;
    return ad.imageUrl.trim().length > 0;
}

export default function MobileStickyFooterAd({
    primaryAd,
    fallbackAd,
    id = 'ad-slot-mobile-sticky-footer',
}: MobileStickyFooterAdProps) {
    const normalizedPrimaryAd = normalizeAdSettings(primaryAd);
    const normalizedFallbackAd = normalizeAdSettings(fallbackAd);
    const activeAd = hasRenderableAd(normalizedPrimaryAd)
        ? normalizedPrimaryAd
        : normalizedFallbackAd;

    if (!activeAd.enabled) {
        return null;
    }

    return (
        <div className="md:hidden fixed inset-x-0 bottom-2 z-50 flex justify-center pointer-events-none px-2">
            <RightSidebarAdSlot
                ad={activeAd}
                id={id}
                iframeTitle="Mobile Sticky Footer Ad"
                scriptRenderMode="iframe"
                placeholderLabel="Sticky Footer 320x50 / 320x100"
                placeholderHint="Mobile sticky ads"
                compactPlaceholder
                className="pointer-events-auto w-full max-w-[320px] h-[50px] min-[400px]:h-[100px] bg-gray-100 dark:bg-[#0f1117] border border-black/8 dark:border-white/5 rounded-lg shadow-lg shadow-black/20 overflow-hidden relative"
            />
        </div>
    );
}
