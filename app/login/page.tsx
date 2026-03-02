'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginUser, ensureUserDoc } from '@/lib/firebase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await loginUser(email, password);
      if (result.success && result.user) {
        await ensureUserDoc(result.user.uid, result.user.email ?? '', result.user.displayName ?? undefined);
        router.push('/quiz');
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl" />
      </div>
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-white tracking-tight">NTU<span className="text-blue-400">learn</span></h1>
          <p className="text-slate-400 mt-2 text-sm">AI-Powered Adaptive Learning Platform</p>
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mt-4">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs text-slate-300">NTU SSO Simulation</span>
          </div>
        </div>
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">NTU Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. student@ntu.edu.sg"
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
              />
            </div>
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-300">{error}</div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white font-semibold py-3.5 rounded-xl transition-all hover:shadow-lg hover:shadow-blue-500/25 disabled:cursor-not-allowed"
            >
              {loading ? 'Loading...' : 'Sign In to NTUlearn'}
            </button>
          </form>
          <div className="mt-6 p-4 bg-white/5 rounded-xl border border-white/10">
            <p className="text-xs text-slate-400 font-medium mb-2">Demo Credentials:</p>
            <div className="space-y-1">
              <p className="text-xs text-slate-500"><span className="text-slate-300">Student:</span> student@ntu.edu.sg / demo1234</p>
              <p className="text-xs text-slate-500"><span className="text-slate-300">Professor:</span> professor@ntu.edu.sg / demo1234</p>
              <p className="text-xs text-slate-500"><span className="text-slate-300">Admin:</span> admin@ntu.edu.sg / demo1234</p>
            </div>
          </div>
        </div>
        <p className="text-center text-xs text-slate-500 mt-6">DLWeek 2026 · Microsoft Track · Nanyang Technological University</p>
      </div>
    </div>
  );
}
