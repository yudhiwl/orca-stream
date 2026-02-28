import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site-config';

/**
 * Generates robots.txt for the website.
 * Next.js automatically serves this at /robots.txt
 *
 * Rules:
 * - Public content (homepage, live-sports) = allow all crawlers
 * - Admin and internal APIs = block all crawlers
 * - Proxy API = block (no indexable content, potential abuse)
 */
export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: ['/', '/live-sports'],
                disallow: ['/admin/', '/api/'],
            },
        ],
        sitemap: `${SITE_URL}/sitemap.xml`,
        host: SITE_URL,
    };
}
