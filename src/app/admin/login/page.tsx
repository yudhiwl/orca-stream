'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type SessionResponse = {
    authenticated?: boolean;
};

export default function AdminLoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const res = await fetch('/api/admin/auth/session', { cache: 'no-store' });
                if (!res.ok) return;
                const data = (await res.json()) as SessionResponse;
                if (mounted && data.authenticated) {
                    router.replace('/admin');
                }
            } catch {
                // ignore
            }
        })();

        return () => {
            mounted = false;
        };
    }, [router]);

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        try {
            const res = await fetch('/api/admin/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            if (!res.ok) {
                let text = 'Login gagal.';
                try {
                    const data = (await res.json()) as { error?: string };
                    if (data.error) text = data.error;
                } catch {
                    // ignore
                }
                setMessage(text);
                return;
            }

            router.replace('/admin');
        } catch {
            setMessage('Gagal terhubung ke server.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#080a0f] text-white flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0f1117] p-6 space-y-4">
                <h1 className="text-xl font-semibold">Admin Login</h1>
                <p className="text-sm text-gray-400">Masuk untuk mengakses panel admin.</p>

                <form onSubmit={onSubmit} className="space-y-3">
                    <div className="space-y-1">
                        <label className="text-xs text-gray-400">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                            autoComplete="username"
                            required
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs text-gray-400">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                            autoComplete="current-password"
                            required
                        />
                    </div>

                    {message && (
                        <div className="text-sm text-rose-400">{message}</div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-700/40 px-3 py-2 text-sm font-medium"
                    >
                        {loading ? 'Memproses...' : 'Masuk'}
                    </button>
                </form>
            </div>
        </div>
    );
}

