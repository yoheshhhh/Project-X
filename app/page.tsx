'use client';

import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center">
      <div className="text-center max-w-2xl mx-auto px-6">
        {/* Badge */}
        <div className="inline-block bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-8">
          <span className="text-blue-300 text-sm font-medium tracking-wide">
            DLWeek 2026 · Microsoft Track
          </span>
        </div>

        {/* Title */}
        <h1 className="text-6xl font-extrabold text-white mb-4 tracking-tight">
          NTU<span className="text-blue-400">learn</span>
        </h1>

        {/* Tagline */}
        <p className="text-xl text-slate-300 mb-12 leading-relaxed">
          An AI-powered adaptive learning platform that understands 
          <span className="text-blue-300 font-medium"> who you are</span> as a learner 
          and <span className="text-blue-300 font-medium">evolves with you</span>.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-wrap justify-center gap-4">
          <button
            onClick={() => router.push('/login')}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold text-lg px-10 py-4 rounded-xl transition-all hover:scale-105 hover:shadow-xl hover:shadow-blue-500/25"
          >
            Get Started →
          </button>
        </div>

        {/* Feature Pills */}
        <div className="flex flex-wrap justify-center gap-3 mt-12">
          {['AI-Powered', 'Adaptive Learning', 'NTU SSO', 'Azure AI', 'Micro-Learning'].map((f) => (
            <span key={f} className="bg-white/5 border border-white/10 text-slate-400 text-xs px-3 py-1.5 rounded-full">
              {f}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
