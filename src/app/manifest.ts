import type { MetadataRoute } from 'next';
import { SITE_NAME, SITE_SHORT_NAME } from '@/lib/site-config';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: `${SITE_NAME} - TV Live Streaming`,
        short_name: SITE_SHORT_NAME,
        description: `Tonton TV live streaming online gratis di ${SITE_NAME} - channel Indonesia dan dunia tanpa registrasi.`,
        start_url: '/',
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#080a0f',
        theme_color: '#4f46e5',
        categories: ['entertainment', 'video'],
        icons: [
            {
                src: '/icons/icon-192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'maskable',
            },
            {
                src: '/icons/icon-512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any',
            },
        ],
    };
}
