import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { ChevronRight, Info } from 'lucide-react';
import { SITE_NAME } from '@/lib/site-config';

export const metadata = {
    title: 'Tentang Kami',
    description: `Kenali lebih dekat ${SITE_NAME}, platform live streaming TV online gratis terbaik dengan akses ke berbagai channel internasional dan olahraga.`,
};

export default function AboutPage() {
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
                            <span className="text-gray-400 dark:text-gray-300">Tentang Kami</span>
                        </li>
                    </ol>
                </nav>

                <article className="bg-white dark:bg-[#0f1117] border border-black/8 dark:border-white/5 rounded-2xl p-6 sm:p-10 shadow-sm">
                    <header className="mb-8">
                        <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-4">
                            <Info className="w-6 h-6 text-indigo-500" />
                        </div>
                        <h1 className="text-3xl font-bold mb-4 bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent">
                            {`Tentang ${SITE_NAME}`}
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-lg">
                            Visi kami adalah menghadirkan kemudahan akses hiburan televisi berkualitas bagi semua orang, kapan saja dan di mana saja.
                        </p>
                    </header>

                    <div className="prose prose-gray dark:prose-invert max-w-none space-y-6 text-gray-600 dark:text-gray-400">
                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Siapa Kami?</h2>
                            <p>
                                {SITE_NAME} adalah platform agregator live streaming TV online yang dirancang untuk memberikan pengalaman menonton yang mulus, stabil, dan sepenuhnya gratis. Kami memahami bahwa di era digital ini, akses terhadap informasi dan hiburan tidak boleh dibatasi oleh ruang dan waktu. Oleh karena itu, kami membangun infrastruktur yang ringan namun kuat agar Anda dapat menikmati tayangan favorit bahkan dengan koneksi internet standar.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Apa yang Kami Tawarkan?</h2>
                            <p>
                                Kami menyediakan ribuan channel dari berbagai belahan dunia, mulai dari berita global, hiburan keluarga, hingga siaran eksklusif olahraga. Semua channel dikategorikan dengan rapi (Sports, News, Entertainment, Movies, dll) untuk memudahkan Anda menemukan konten yang tepat dalam hitungan detik.
                            </p>
                            <ul className="list-disc pl-5 mt-2 space-y-2">
                                <li><strong>Kualitas Adaptif:</strong> Resolusi video menyesuaikan dengan kecepatan internet Anda secara otomatis.</li>
                                <li><strong>Bebas Registrasi:</strong> Anda tidak perlu membuat akun atau memasukkan data pribadi untuk menonton.</li>
                                <li><strong>Multi-Device:</strong> Kompatibel dengan smartphone, tablet, laptop, dan Smart TV.</li>
                                <li><strong>Update Real-time:</strong> Link stream dipantau 24/7 untuk memastikan stabilitas siaran.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Misi Sosial Kami</h2>
                            <p>
                                Di luar teknologi, kami percaya pada kebebasan akses informasi. {SITE_NAME} berkomitmen untuk tetap menjadi platform yang dapat diakses secara gratis oleh masyarakat luas, mendukung pemerataan informasi dan hiburan berkualitas di seluruh pelosok Indonesia dan dunia.
                            </p>
                        </section>

                        <div className="pt-8 border-t border-black/8 dark:border-white/5 mt-8 text-center">
                            <p className="text-sm">Selamat Menonton!</p>
                            <p className="font-bold text-indigo-500 dark:text-indigo-400 mt-1">{`Tim ${SITE_NAME}`}</p>
                        </div>
                    </div>
                </article>
            </main>
        </div>
    );
}
