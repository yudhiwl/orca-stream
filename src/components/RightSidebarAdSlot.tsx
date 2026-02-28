'use client';

import { useEffect, useRef } from 'react';
import { RightSidebarAdSettings } from '@/lib/right-sidebar-ad';

type RightSidebarAdSlotProps = {
    ad: RightSidebarAdSettings;
    id?: string;
    className?: string;
    iframeTitle: string;
    placeholderLabel?: string;
    placeholderHint?: string;
    compactPlaceholder?: boolean;
    scriptRenderMode?: 'direct' | 'iframe';
};

function buildAdScriptDocument(rawScriptOrHtml: string): string {
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: transparent;
    }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
    }
  </style>
</head>
<body>
${rawScriptOrHtml}
</body>
</html>`;
}

export default function RightSidebarAdSlot({
    ad,
    id = 'ad-slot-320x600',
    className = 'w-full max-w-[320px] h-auto mx-auto bg-gray-100 dark:bg-[#0f1117] border border-black/8 dark:border-white/5 rounded-xl flex flex-col items-center justify-center gap-2 overflow-hidden relative',
    iframeTitle,
    placeholderLabel = 'Ad Slot 300x250 / 300x600',
    placeholderHint = 'Pasang iklan kamu di sini',
    compactPlaceholder = false,
    scriptRenderMode = 'iframe',
}: RightSidebarAdSlotProps) {
    const scriptAdContainerRef = useRef<HTMLDivElement | null>(null);
    const rootClassName = `relative overflow-hidden ${className}`.trim();

    if (!ad.enabled) {
        return null;
    }

    useEffect(() => {
        const container = scriptAdContainerRef.current;
        if (!container) return;

        const shouldRenderScript =
            ad.enabled &&
            ad.type === 'script' &&
            ad.script.trim().length > 0;

        container.innerHTML = '';
        if (!shouldRenderScript) return;

        const template = document.createElement('div');
        template.innerHTML = ad.script;

        const nodes = Array.from(template.childNodes);
        for (const node of nodes) {
            if (node.nodeName.toLowerCase() === 'script') {
                const oldScript = node as HTMLScriptElement;
                const script = document.createElement('script');

                for (const attr of Array.from(oldScript.attributes)) {
                    script.setAttribute(attr.name, attr.value);
                }

                if (oldScript.src) {
                    script.src = oldScript.src;
                    script.async = oldScript.async;
                } else {
                    script.text = oldScript.textContent ?? '';
                }
                container.appendChild(script);
            } else {
                container.appendChild(node.cloneNode(true));
            }
        }

        return () => {
            container.innerHTML = '';
        };
    }, [ad.enabled, ad.type, ad.script]);

    return (
        <div className={rootClassName} id={id}>
            {ad.enabled && ad.type === 'script' && ad.script.trim() ? (
                scriptRenderMode === 'iframe' ? (
                    <iframe
                        title={`${iframeTitle} Script`}
                        srcDoc={buildAdScriptDocument(ad.script)}
                        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
                        loading="lazy"
                        className="absolute inset-0 w-full h-full border-0"
                    />
                ) : (
                    <div
                        ref={scriptAdContainerRef}
                        className="absolute inset-0 w-full h-full"
                    />
                )
            ) : ad.enabled && ad.type === 'iframe' && ad.iframeUrl ? (
                <iframe
                    title={iframeTitle}
                    src={ad.iframeUrl}
                    sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="absolute inset-0 w-full h-full border-0"
                />
            ) : ad.enabled && ad.imageUrl ? (
                ad.clickUrl ? (
                    <a
                        href={ad.clickUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute inset-0 block"
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={ad.imageUrl}
                            alt={ad.altText || 'Sponsored'}
                            className="w-full h-full object-cover"
                        />
                    </a>
                ) : (
                    <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={ad.imageUrl}
                            alt={ad.altText || 'Sponsored'}
                            className="w-full h-full object-cover"
                        />
                    </>
                )
            ) : (
                <>
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/10 to-purple-900/10" />
                    <div className="relative z-10 text-center px-4">
                        {!compactPlaceholder && <div className="text-3xl mb-2">Ad</div>}
                        <p className={`${compactPlaceholder ? 'text-[10px]' : 'text-xs'} text-gray-500 font-medium`}>
                            {placeholderLabel}
                        </p>
                        <p className={`${compactPlaceholder ? 'text-[9px]' : 'text-[10px]'} text-gray-400 dark:text-gray-700 mt-1`}>
                            {placeholderHint}
                        </p>
                    </div>
                </>
            )}
        </div>
    );
}
