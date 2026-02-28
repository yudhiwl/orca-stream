import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site-config';

/**
 * Generates a dynamic sitemap.xml for the website.
 * Next.js automatically serves this at /sitemap.xml
 *
 * Priority guide:
 *   1.0 = homepage
 *   0.9 = key tool pages
 *   0.7 = secondary pages
 */
export default function sitemap(): MetadataRoute.Sitemap {
    const now = new Date();

    return [
        {
            url: SITE_URL,
            lastModified: now,
            changeFrequency: 'daily',
            priority: 1.0,
        },
        {
            url: `${SITE_URL}/live-sports`,
            lastModified: now,
            // Live sports changes every day — high crawl frequency
            changeFrequency: 'always',
            priority: 0.9,
        },
    ];
}
