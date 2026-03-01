'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginUser, registerUser } from '@/lib/firebase';

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('student');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        const result = await loginUser(email, password);
        if (result.success) { router.push('/dashboard'); } else { setError(result.error || 'Login failed'); }
      } else {
        const result = await registerUser(email, password, role, name);
        if (result.success) { router.push('/quiz'); } else { setError(result.error || 'Registration failed'); }
      }
    } catch (err) { setError(err.message || 'Something went wrong'); }
    finally { setLoading(false); }
  };

  const roles = [
    { value: 'student', label: 'Student', icon: '🎓', desc: 'Access courses, quizzes & AI tutor' },
    { value: 'professor', label: 'Professor', icon: '👨‍🏫', desc: 'Manage content & view analytics' },
    { value: 'admin', label: 'Admin', icon: '⚙️', desc: 'System configuration & settings' },
  ];

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
          <div className="flex bg-white/5 rounded-xl p-1 mb-6">
            <button onClick={() => setIsLogin(true)} className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${isLogin ? 'bg-blue-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Sign In</button>
            <button onClick={() => setIsLogin(false)} className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${!isLogin ? 'bg-blue-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Register</button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (<div><label className="block text-sm text-slate-300 mb-1.5">Full Name</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Narhen Karthikeyan" required={!isLogin} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all" /></div>)}
            <div><label className="block text-sm text-slate-300 mb-1.5">NTU Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. student@ntu.edu.sg" required className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all" /></div>
            <div><label className="block text-sm text-slate-300 mb-1.5">Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" required className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all" /></div>
            {!isLogin && (<div><label className="block text-sm text-slate-300 mb-2">Role</label><div className="grid grid-cols-3 gap-2">{roles.map((r) => (<button key={r.value} type="button" onClick={() => setRole(r.value)} className={`p-3 rounded-xl border text-center transition-all ${role === r.value ? 'bg-blue-500/20 border-blue-500/50 ring-1 ring-blue-500/30' : 'bg-white/5 border-white/10 hover:border-white/20'}`}><div className="text-2xl mb-1">{r.icon}</div><div className="text-xs font-medium text-white">{r.label}</div></button>))}</div></div>)}
            {error && (<div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-300">{error}</div>)}
            <button type="submit" disabled={loading} className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white font-semibold py-3.5 rounded-xl transition-all hover:shadow-lg hover:shadow-blue-500/25 disabled:cursor-not-allowed">{loading ? 'Loading...' : (isLogin ? 'Sign In to NTUlearn' : 'Create Account')}</button>
          </form>
          {isLogin && (<div className="mt-6 p-4 bg-white/5 rounded-xl border border-white/10"><p className="text-xs text-slate-400 font-medium mb-2">Demo Credentials:</p><div className="space-y-1"><p className="text-xs text-slate-500"><span className="text-slate-300">Student:</span> student@ntu.edu.sg / demo1234</p><p className="text-xs text-slate-500"><span className="text-slate-300">Professor:</span> professor@ntu.edu.sg / demo1234</p><p className="text-xs text-slate-500"><span className="text-slate-300">Admin:</span> admin@ntu.edu.sg / demo1234</p></div></div>)}
        </div>
        <p className="text-center text-xs text-slate-500 mt-6">DLWeek 2026 · Microsoft Track · Nanyang Technological University</p>
      </div>
    </div>
  );
}
