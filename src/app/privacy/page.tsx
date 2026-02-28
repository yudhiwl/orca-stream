import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { ChevronRight, Shield } from 'lucide-react';
import { SITE_NAME } from '@/lib/site-config';

export const metadata = {
    title: 'Kebijakan Privasi',
    description: `Informasi lengkap mengenai bagaimana kami mengelola data dan privasi Anda selama menggunakan layanan streaming ${SITE_NAME}.`,
};

export default function PrivacyPage() {
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
                            <span className="text-gray-400 dark:text-gray-300">Kebijakan Privasi</span>
                        </li>
                    </ol>
                </nav>

                <article className="bg-white dark:bg-[#0f1117] border border-black/8 dark:border-white/5 rounded-2xl p-6 sm:p-10 shadow-sm">
                    <header className="mb-8 border-b border-black/8 dark:border-white/5 pb-6">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4">
                            <Shield className="w-6 h-6 text-emerald-500" />
                        </div>
                        <h1 className="text-3xl font-bold mb-2">Kebijakan Privasi</h1>
                        <p className="text-gray-500 text-sm">Terakhir diperbarui: 25 Februari 2026</p>
                    </header>

                    <div className="prose prose-gray dark:prose-invert max-w-none space-y-8 text-gray-600 dark:text-gray-400">
                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">1. Pendahuluan</h2>
                            <p>
                                Privasi Anda adalah hal yang sangat penting bagi kami. Kami di {SITE_NAME} berkomitmen untuk melindungi informasi Anda. Kebijakan Privasi ini menjelaskan jenis informasi apa yang kami kumpulkan, bagaimana kami menggunakannya, dan langkah-langkah yang kami ambil untuk memastikan data tersebut tetap aman.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">2. Pengumpulan Data</h2>
                            <p>
                                <strong>{SITE_NAME} tidak mengharuskan pengguna untuk mendaftar.</strong> Oleh karena itu, kami tidak mengumpulkan informasi pribadi yang dapat mengidentifikasi Anda secara langsung seperti nama, nomor telepon, atau alamat rumah. Informasi yang mungkin terkumpul secara otomatis meliputi:
                            </p>
                            <ul className="list-disc pl-5 mt-2 space-y-2">
                                <li>Data Log: Termasuk alamat Protokol Internet (IP), jenis browser, penyedia layanan internet (ISP), dan waktu kunjungan.</li>
                                <li>Cookies: Kami menggunakan cookies untuk menyimpan preferensi Anda (seperti pilihan Tema Dark/Light) agar pengalaman menonton lebih personal.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">3. Penggunaan Informasi</h2>
                            <p>
                                Informasi yang dikumpulkan digunakan semata-mata untuk:
                            </p>
                            <ul className="list-disc pl-5 mt-2 space-y-2">
                                <li>Mengoptimalkan kualitas streaming berdasarkan lokasi geografis anonim.</li>
                                <li>Menganalisis tren penggunaan untuk pengembangan fitur di masa mendatang.</li>
                                <li>Menayangkan iklan yang relevan melalui mitra periklanan pihak ketiga.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">4. Keamanan</h2>
                            <p>
                                Kami mengambil langkah-langkah keamanan yang wajar untuk melindungi data anonim Anda dari akses yang tidak sah atau pengungkapan. Namun, perlu dicatat bahwa tidak ada transmisi data melalui internet yang 100% aman.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">5. Perubahan Kebijakan</h2>
                            <p>
                                Kami berhak memperbarui Kebijakan Privasi ini kapan saja. Kami menyarankan Anda untuk meninjau halaman ini secara berkala untuk mengetahui perubahan apa pun.
                            </p>
                        </section>
                    </div>
                </article>
            </main>
        </div>
    );
}
