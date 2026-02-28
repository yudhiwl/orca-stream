const DEFAULT_SITE_URL = 'https://orcatv.my.id';

function normalizeSiteUrl(rawUrl: string | undefined): string {
    if (!rawUrl) return DEFAULT_SITE_URL;
    const value = rawUrl.trim();
    if (!value) return DEFAULT_SITE_URL;

    try {
        return new URL(value).toString().replace(/\/$/, '');
    } catch {
        return DEFAULT_SITE_URL;
    }
}

const SITE_NAME = 'Orca Stream';
const SITE_SHORT_NAME = SITE_NAME;
const SITE_URL = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
const SITE_DOMAIN = new URL(SITE_URL).hostname;
const SITE_EMAIL = `support@${SITE_DOMAIN}`;
const SITE_TWITTER = '@orcastream';

export {
    SITE_NAME,
    SITE_SHORT_NAME,
    SITE_URL,
    SITE_DOMAIN,
    SITE_EMAIL,
    SITE_TWITTER,
};
