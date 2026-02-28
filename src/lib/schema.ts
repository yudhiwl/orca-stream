import { SITE_NAME, SITE_URL } from '@/lib/site-config';

const SITE_DESCRIPTION = 'Tonton siaran TV live dari berbagai channel Indonesia dan dunia secara online gratis. Stream langsung tanpa buffering.';
const ORG_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

export function buildWebSite() {
    return {
        '@type': 'WebSite',
        '@id': WEBSITE_ID,
        url: SITE_URL,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        publisher: { '@id': ORG_ID },
        inLanguage: 'id-ID',
    };
}

export function buildOrganization() {
    return {
        '@type': 'Organization',
        '@id': ORG_ID,
        name: SITE_NAME,
        url: SITE_URL,
        logo: {
            '@type': 'ImageObject',
            url: `${SITE_URL}/icons/logo.svg`,
        },
    };
}

export function buildWebPage({
    id,
    url,
    name,
    description,
    breadcrumb,
}: {
    id: string;
    url: string;
    name: string;
    description: string;
    breadcrumb?: { name: string; url: string }[];
}) {
    const page: Record<string, unknown> = {
        '@type': 'WebPage',
        '@id': id,
        url,
        name,
        description,
        isPartOf: { '@id': WEBSITE_ID },
        publisher: { '@id': ORG_ID },
        inLanguage: 'id-ID',
    };
    if (breadcrumb && breadcrumb.length > 0) {
        page.breadcrumb = {
            '@type': 'BreadcrumbList',
            itemListElement: breadcrumb.map((b, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                name: b.name,
                item: b.url,
            })),
        };
    }
    return page;
}

export function buildWebApplication({
    name,
    description,
    url,
}: {
    name: string;
    description: string;
    url: string;
}) {
    return {
        '@type': 'WebApplication',
        name,
        description,
        url,
        applicationCategory: 'EntertainmentApplication',
        operatingSystem: 'Web',
        offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'IDR',
        },
    };
}

/**
 * Builds a FAQPage schema entity from an array of question/answer pairs.
 * Per Google guidelines, FAQ content MUST be visible on the page.
 */
export function buildFAQPage(faqs: { question: string; answer: string }[]) {
    return {
        '@type': 'FAQPage',
        mainEntity: faqs.map((faq) => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: {
                '@type': 'Answer',
                text: faq.answer,
            },
        })),
    };
}

/**
 * Builds a VideoObject schema entity for a streaming channel page.
 * Includes a BroadcastEvent publication to signal live broadcasting to Google.
 * Per Google guidelines, thumbnailUrl and uploadDate are required fields.
 */
export function buildVideoObject({
    name,
    description,
    thumbnailUrl,
    contentUrl,
    watchUrl,
    isLive = false,
}: {
    name: string;
    description: string;
    thumbnailUrl: string;
    contentUrl?: string;
    /** The page URL where the user watches the video — used for potentialAction WatchAction */
    watchUrl?: string;
    isLive?: boolean;
}) {
    const entity: Record<string, unknown> = {
        '@type': 'VideoObject',
        name,
        description,
        thumbnailUrl,
        // uploadDate is required by Google; for channel pages we use a stable reference date
        uploadDate: new Date().toISOString().split('T')[0],
        publisher: { '@id': ORG_ID },
        inLanguage: 'id-ID',
    };

    if (contentUrl) {
        entity.contentUrl = contentUrl;
    }

    // potentialAction: signals to Google that this page is a watch destination
    if (watchUrl) {
        entity.potentialAction = {
            '@type': 'WatchAction',
            target: watchUrl,
        };
    }

    // For live streams: wrap in BroadcastEvent to signal real-time broadcast
    if (isLive) {
        entity.publication = {
            '@type': 'BroadcastEvent',
            isLiveBroadcast: true,
            publishedOn: {
                '@type': 'BroadcastService',
                name: SITE_NAME,
                url: SITE_URL,
            },
        };
    }

    return entity;
}

export function buildJsonLd(entities: unknown[]) {

    return {
        '@context': 'https://schema.org',
        '@graph': entities,
    };
}

export { SITE_URL, SITE_NAME };
