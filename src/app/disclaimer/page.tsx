import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { ChevronRight, AlertTriangle } from 'lucide-react';
import { SITE_NAME } from '@/lib/site-config';

export const metadata = {
    title: 'Disclaimer',
    description: `Pernyataan sanggahan mengenai konten dan hak cipta di ${SITE_NAME}. Kami tidak menyimpan video di server kami sendiri.`,
};

export default function DisclaimerPage() {
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
                            <span className="text-gray-400 dark:text-gray-300">Disclaimer</span>
                        </li>
                    </ol>
                </nav>

                <article className="bg-white dark:bg-[#0f1117] border border-black/8 dark:border-white/5 rounded-2xl p-6 sm:p-10 shadow-sm">
                    <header className="mb-8 border-b border-black/8 dark:border-white/5 pb-6">
                        <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center mb-4">
                            <AlertTriangle className="w-6 h-6 text-red-500" />
                        </div>
                        <h1 className="text-3xl font-bold mb-2">Disclaimer</h1>
                        <p className="text-gray-500 text-sm">Pernyataan Sanggahan Konten</p>
                    </header>

                    <div className="prose prose-gray dark:prose-invert max-w-none space-y-8 text-gray-600 dark:text-gray-400">
                        <section className="bg-red-500/5 p-6 rounded-xl border border-red-500/10">
                            <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-3">Satu Hal Penting</h2>
                            <p>
                                <strong>{SITE_NAME} tidak menyimpan (hosting) file video atau streaming di server kami sendiri.</strong> Kami hanya menyediakan link ke konten yang tersedia secara publik di internet melalui server pihak ketiga.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Konten Hak Cipta</h2>
                            <p>
                                Kami sangat menghormati hak kepemilikan intelektual. Seluruh gambar, logo channel, dan link stream yang ditampilkan adalah milik dari pemegang hak cipta masing-masing perusahaannya. Jika Anda adalah pemilik hak cipta dan merasa link stream tertentu melanggar hak Anda, silakan hubungi tim kami untuk permintaan penghapusan (Take Down).
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Penggunaan Luar Tanggung Jawab</h2>
                            <p>
                                Ketersediaan siaran sepenuhnya tergantung pada server penyedia pihak ketiga. Kami tidak dapat memberikan jaminan orisinalitas, keamanan, atau kebebasan dari virus pada server luar tersebut. Pengguna menggunakan link di {SITE_NAME} atas risiko sendiri.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Perubahan Konten</h2>
                            <p>
                                Kami sewaktu-waktu dapat menambahkan, menghapus, atau mengubah daftar channel olahraga atau TV tanpa pemberitahuan sebelumnya demi menjaga kualitas layanan agregator kami.
                            </p>
                        </section>
                    </div>
                </article>
            </main>
        </div>
    );
}
