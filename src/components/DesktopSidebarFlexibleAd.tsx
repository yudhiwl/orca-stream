import RightSidebarAdSlot from '@/components/RightSidebarAdSlot';
import { RightSidebarAdSettings } from '@/lib/right-sidebar-ad';
import styles from '@/components/DesktopSidebarFlexibleAd.module.css';

interface DesktopSidebarFlexibleAdProps {
    ad: RightSidebarAdSettings;
    id: string;
    iframeTitle: string;
    placeholderLabel?: string;
    className?: string;
}

export default function DesktopSidebarFlexibleAd({
    ad,
    id,
    iframeTitle,
    placeholderLabel = 'Sidebar Ad 300x250 / 300x600',
    className = '',
}: DesktopSidebarFlexibleAdProps) {
    if (!ad.enabled) {
        return null;
    }

    const containerClassName = ['bg-white dark:bg-[#0f1117] border border-black/8 dark:border-white/5 rounded-2xl overflow-hidden', className]
        .filter(Boolean)
        .join(' ');

    return (
        <div className={containerClassName}>
            <div className="p-2 flex justify-center">
                <RightSidebarAdSlot
                    ad={ad}
                    id={id}
                    iframeTitle={iframeTitle}
                    placeholderLabel={placeholderLabel}
                    className={`${styles.sidebarSlot} relative overflow-hidden bg-transparent border-0 rounded-none shadow-none`}
                />
            </div>
        </div>
    );
}
