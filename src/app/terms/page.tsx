import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { ChevronRight, FileText } from 'lucide-react';
import { SITE_NAME } from '@/lib/site-config';

export const metadata = {
    title: 'Syarat & Ketentuan',
    description: `Ketentuan penggunaan layanan ${SITE_NAME}. Pastikan Anda memahami aturan saat menggunakan platform streaming kami.`,
};

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#080a0f] text-gray-900 dark:text-white flex flex-col">
            <Navbar />

            <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
                {/* Breadcrumb */}
                <nav className="mb-6" aria-label="Breadcrumb">
                    <ol className="flex items-center gap-1.5 text-sm font-medium text-gray-500">
                        <li className="flex items-center">
                            <Link href="/" className="text-gray-600 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-gray-300 transition-colors">
                                Beranda
                            </Link>
                        </li>
                        <li aria-hidden="true" className="flex items-center text-gray-400 dark:text-gray-700">
                            <ChevronRight className="w-3.5 h-3.5" />
                        </li>
                        <li className="flex items-center">
                            <span className="text-gray-400 dark:text-gray-300">Syarat & Ketentuan</span>
                        </li>
                    </ol>
                </nav>

                <article className="bg-white dark:bg-[#0f1117] border border-black/8 dark:border-white/5 rounded-2xl p-6 sm:p-10 shadow-sm">
                    <header className="mb-8 border-b border-black/8 dark:border-white/5 pb-6">
                        <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center mb-4">
                            <FileText className="w-6 h-6 text-orange-500" />
                        </div>
                        <h1 className="text-3xl font-bold mb-2">Syarat & Ketentuan</h1>
                        <p className="text-gray-500 text-sm">Terakhir diperbarui: 25 Februari 2026</p>
                    </header>

                    <div className="prose prose-gray dark:prose-invert max-w-none space-y-8 text-gray-600 dark:text-gray-400">
                        <p>
                            Dengan mengakses dan menggunakan {SITE_NAME}, Anda setuju untuk terikat oleh Syarat dan Ketentuan berikut. Jika Anda tidak setuju dengan bagian mana pun, harap berhenti menggunakan layanan kami.
                        </p>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">1. Penggunaan Layanan</h2>
                            <p>
                                Layanan {SITE_NAME} disediakan untuk penggunaan pribadi dan non-komersial. Anda dilarang keras untuk:
                            </p>
                            <ul className="list-disc pl-5 mt-2 space-y-2">
                                <li>Melakukan reverse engineering terhadap kode platform.</li>
                                <li>Menggunakan bot atau skrip otomatis untuk menarik konten (scraping).</li>
                                <li>{`Menayangkan ulang (rebroadcast) konten dari ${SITE_NAME} untuk tujuan komersial tanpa izin.`}</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">2. Konten Pihak Ketiga</h2>
                            <p>
                                Halaman kami berisi link ke server pihak ketiga (HLS/DASH streams). Kami tidak memiliki kendali atas konten tersebut dan tidak bertanggung jawab atas ketepatan, legalitas, atau ketersediaan sumber siaran tersebut.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">3. Batasan Tanggung Jawab</h2>
                            <p>
                                {SITE_NAME} tidak memberikan jaminan bahwa layanan akan selalu tersedia tanpa gangguan. Kami tidak bertanggung jawab atas kerugian apa pun yang muncul akibat kegagalan teknis, buffering, atau penghentian siaran secara tiba-tiba dari sumber aslinya.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">4. Hak Kekayaan Intelektual</h2>
                            <p>
                                Seluruh logo channel, brand, dan konten siaran adalah milik masing-masing pemegang hak siar asli. {SITE_NAME} hanya berfungsi sebagai perantara akses.
                            </p>
                        </section>
                    </div>
                </article>
            </main>
        </div>
    );
}
