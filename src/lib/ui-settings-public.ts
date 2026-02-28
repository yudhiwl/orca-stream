import { readPlayerSettings } from '@/lib/player-settings';
import {
    AdSettings,
    RightSidebarAdSettings,
    normalizeAdSettings,
    normalizeRightSidebarAdSettings,
} from '@/lib/right-sidebar-ad';

export type PublicUiSettings = {
    rightSidebarAd: RightSidebarAdSettings;
    topPlayerAd: AdSettings;
    topPlayerMobileFallbackAd: AdSettings;
};

export function readPublicUiSettings(): PublicUiSettings {
    const settings = readPlayerSettings();

    return {
        rightSidebarAd: normalizeRightSidebarAdSettings({
            enabled: settings.rightSidebarAdEnabled,
            type: settings.rightSidebarAdType,
            imageUrl: settings.rightSidebarAdImageUrl,
            iframeUrl: settings.rightSidebarAdIframeUrl,
            script: settings.rightSidebarAdScript,
            clickUrl: settings.rightSidebarAdClickUrl,
            altText: settings.rightSidebarAdAltText || 'Sponsored',
        }),
        topPlayerAd: normalizeAdSettings({
            enabled: settings.topPlayerAdEnabled,
            type: settings.topPlayerAdType,
            imageUrl: settings.topPlayerAdImageUrl,
            iframeUrl: settings.topPlayerAdIframeUrl,
            script: settings.topPlayerAdScript,
            clickUrl: settings.topPlayerAdClickUrl,
            altText: settings.topPlayerAdAltText || 'Sponsored',
        }),
        topPlayerMobileFallbackAd: normalizeAdSettings({
            enabled: settings.topPlayerMobileFallbackEnabled,
            type: settings.topPlayerMobileFallbackType,
            imageUrl: settings.topPlayerMobileFallbackImageUrl,
            iframeUrl: settings.topPlayerMobileFallbackIframeUrl,
            script: settings.topPlayerMobileFallbackScript,
            clickUrl: settings.topPlayerMobileFallbackClickUrl,
            altText: settings.topPlayerMobileFallbackAltText || 'Sponsored',
        }),
    };
}
