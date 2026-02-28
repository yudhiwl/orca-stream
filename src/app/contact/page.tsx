import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { ChevronRight, Mail, MapPin, MessageSquare } from 'lucide-react';
import { SITE_EMAIL, SITE_NAME } from '@/lib/site-config';

export const metadata = {
    title: 'Kontak Kami',
    description: `Hubungi tim ${SITE_NAME} untuk pertanyaan, masukan, atau kerja sama. Kami siap membantu Anda mendapatkan pengalaman streaming terbaik.`,
};

export default function ContactPage() {
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
                            <span className="text-gray-400 dark:text-gray-300">Hubungi Kami</span>
                        </li>
                    </ol>
                </nav>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1 space-y-4">
                        <h1 className="text-3xl font-bold mb-4 transition-colors">Kontak Kami</h1>
                        <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-6">
                            Punya pertanyaan seputar layanan kami? Atau ingin bekerja sama? Tim kami siap menjawab setiap pesan Anda secepat mungkin.
                        </p>

                        <div className="space-y-4">
                            <div className="flex items-center gap-3 p-4 bg-white dark:bg-[#0f1117] border border-black/8 dark:border-white/5 rounded-xl">
                                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                                    <Mail className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-500 dark:text-gray-500 uppercase font-bold tracking-wider">Email</p>
                                    <p className="text-sm font-medium">{SITE_EMAIL}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-4 bg-white dark:bg-[#0f1117] border border-black/8 dark:border-white/5 rounded-xl">
                                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500">
                                    <MessageSquare className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-500 dark:text-gray-500 uppercase font-bold tracking-wider">Sosial Media</p>
                                    <p className="text-sm font-medium">@orcastream_official</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-4 bg-white dark:bg-[#0f1117] border border-black/8 dark:border-white/5 rounded-xl">
                                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                    <MapPin className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-500 dark:text-gray-500 uppercase font-bold tracking-wider">Lokasi</p>
                                    <p className="text-sm font-medium">Jakarta, Indonesia</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="md:col-span-2">
                        <div className="bg-white dark:bg-[#0f1117] border border-black/8 dark:border-white/5 rounded-2xl p-6 sm:p-8 shadow-sm">
                            <h2 className="text-2xl font-bold mb-6">Kirim Pesan</h2>
                            <form className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Nama Lengkap</label>
                                        <input
                                            type="text"
                                            placeholder="Masukkan nama Anda"
                                            className="w-full bg-gray-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-indigo-500 transition-colors"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Alamat Email</label>
                                        <input
                                            type="email"
                                            placeholder="email@contoh.com"
                                            className="w-full bg-gray-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-indigo-500 transition-colors"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Subjek</label>
                                    <input
                                        type="text"
                                        placeholder="Apa yang ingin Anda sampaikan?"
                                        className="w-full bg-gray-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-indigo-500 transition-colors"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Pesan</label>
                                    <textarea
                                        rows={5}
                                        placeholder="Tuliskan detail pertanyaan atau masukan Anda..."
                                        className="w-full bg-gray-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-indigo-500 transition-colors resize-none"
                                    ></textarea>
                                </div>
                                <button
                                    type="button"
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg shadow-lg shadow-indigo-600/20 transition-all active:scale-[0.98]"
                                >
                                    Kirim Sekarang
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
