export type AdSettings = {
    enabled: boolean;
    type: 'image' | 'iframe' | 'script';
    imageUrl: string;
    iframeUrl: string;
    script: string;
    clickUrl: string;
    altText: string;
};

export type RightSidebarAdSettings = AdSettings;

export const DEFAULT_AD_SETTINGS: AdSettings = {
    enabled: false,
    type: 'image',
    imageUrl: '',
    iframeUrl: '',
    script: '',
    clickUrl: '',
    altText: 'Sponsored',
};

export const DEFAULT_RIGHT_SIDEBAR_AD = DEFAULT_AD_SETTINGS;

export function normalizeAdSettings(
    ad?: Partial<AdSettings>
): AdSettings {
    return {
        enabled: ad?.enabled === true,
        type:
            ad?.type === 'iframe' || ad?.type === 'script'
                ? ad.type
                : 'image',
        imageUrl: String(ad?.imageUrl ?? ''),
        iframeUrl: String(ad?.iframeUrl ?? ''),
        script: String(ad?.script ?? ''),
        clickUrl: String(ad?.clickUrl ?? ''),
        altText: String(ad?.altText ?? 'Sponsored') || 'Sponsored',
    };
}

export function normalizeRightSidebarAdSettings(
    ad?: Partial<RightSidebarAdSettings>
): RightSidebarAdSettings {
    return normalizeAdSettings(ad);
}

export function hasRenderableAd(ad: AdSettings): boolean {
    if (!ad.enabled) return false;
    if (ad.type === 'script') return ad.script.trim().length > 0;
    if (ad.type === 'iframe') return ad.iframeUrl.trim().length > 0;
    return ad.imageUrl.trim().length > 0;
}
