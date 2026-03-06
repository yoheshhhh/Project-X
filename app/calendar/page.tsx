'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppSidebar } from '@/components/AppSidebar';
import { useStudentData } from '@/lib/useStudentData';

const EVENTS = [
  { id: '1', title: 'Introduction to Databases – Lecture', date: 'Mon 3 Mar', time: '10:00', type: 'lecture', location: 'LT1A' },
  { id: '2', title: 'Computer Security – Tutorial', date: 'Tue 4 Mar', time: '14:00', type: 'tutorial', location: 'NS4-02-12' },
  { id: '3', title: 'Assignment 2 due (Software Security)', date: 'Wed 5 Mar', time: '23:59', type: 'deadline', location: '—' },
  { id: '4', title: 'Sustainability – LEC', date: 'Thu 6 Mar', time: '09:00', type: 'lecture', location: 'LHS-LT' },
  { id: '5', title: 'Mid-term quiz (Databases)', date: 'Fri 7 Mar', time: '16:00', type: 'exam', location: 'Online' },
];

const typeStyles: Record<string, string> = {
  lecture: 'bg-blue-100 text-blue-800',
  tutorial: 'bg-amber-100 text-amber-800',
  deadline: 'bg-rose-100 text-rose-800',
  exam: 'bg-violet-100 text-violet-800',
  review: 'bg-emerald-100 text-emerald-800',
  'spaced-rep': 'bg-purple-100 text-purple-800',
};

/**
 * Generate AI-powered review schedule from retention data + SM-2 spaced repetition.
 * Each topic that needs review gets assigned a day and optimal time slot.
 */
function generateSmartReviewSchedule(retentionRates: any[], optimalStudyTime: any[]): any[] {
  if (!retentionRates || retentionRates.length === 0) return [];

  const peakTime = optimalStudyTime?.find((t: any) => t.performance === 'peak');
  const goodTime = optimalStudyTime?.find((t: any) => t.performance === 'good');
  const defaultTime = peakTime?.label || goodTime?.label || 'Morning (9am-12pm)';

  // Extract time string from label
  const extractTime = (label: string) => {
    const match = label.match(/\(([^)]+)\)/);
    return match ? match[1].split('-')[0] : '10:00am';
  };

  const urgencyOrder: Record<string, number> = { critical: 0, 'review-soon': 1, fading: 2, fresh: 3 };
  const sorted = [...retentionRates]
    .filter(r => r.urgency !== 'fresh')
    .sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

  const today = new Date();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return sorted.map((r, i) => {
    // Schedule based on urgency: critical = today/tomorrow, review-soon = 2-3 days, fading = 4-7 days
    const daysOffset = r.urgency === 'critical' ? i : r.urgency === 'review-soon' ? 2 + i : 4 + i;
    const reviewDate = new Date(today.getTime() + daysOffset * 86400000);
    const dayStr = `${dayNames[reviewDate.getDay()]} ${reviewDate.getDate()} ${monthNames[reviewDate.getMonth()]}`;

    // Use optimal time for hard topics, any time for easier ones
    const timeSlot = r.retention < 50 ? extractTime(defaultTime) : extractTime(goodTime?.label || defaultTime);

    // SM-2 interval: topics with lower retention get shorter intervals
    const interval = r.retention < 40 ? '1 day' : r.retention < 60 ? '3 days' : '7 days';

    return {
      id: `review-${i}`,
      topic: r.topic,
      retention: r.retention,
      urgency: r.urgency,
      date: dayStr,
      time: timeSlot,
      type: r.urgency === 'critical' ? 'review' : 'spaced-rep',
      interval,
      originalScore: r.originalScore,
      daysSinceStudied: r.daysSinceStudied,
    };
  });
}

export default function CalendarPage() {
  const router = useRouter();
  const handleSignOut = () => router.push('/');
  const { studentData } = useStudentData();
  const [activeTab, setActiveTab] = useState<'events' | 'reviews'>('reviews');

  const retentionRates = studentData?.retentionRates ?? [];
  const optimalStudyTime = studentData?.optimalStudyTime ?? [];
  const reviewSchedule = generateSmartReviewSchedule(retentionRates, optimalStudyTime);
  const peakTime = optimalStudyTime.find((t: any) => t.performance === 'peak');

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(165deg, #f8fafc 0%, #f1f5f9 35%, #e2e8f0 100%)' }}>
      <AppSidebar currentPath="/calendar" onSignOut={handleSignOut} />
      <main className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto px-6 py-8">
          <p className="font-medium text-indigo-600 text-sm uppercase tracking-widest mb-1">Calendar</p>
          <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-3xl font-bold tracking-tight text-slate-900 mb-2">
            Smart Schedule
          </h1>
          <p className="text-slate-500 text-sm mb-6">AI-powered review schedule based on your memory retention + spaced repetition</p>

          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            <button onClick={() => setActiveTab('reviews')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === 'reviews' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white/80 text-slate-600 hover:bg-white'}`}>
              🧠 Smart Review ({reviewSchedule.length})
            </button>
            <button onClick={() => setActiveTab('events')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === 'events' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white/80 text-slate-600 hover:bg-white'}`}>
              📅 Events ({EVENTS.length})
            </button>
          </div>

          {activeTab === 'reviews' && (
            <>
              {/* AI recommendation banner */}
              {peakTime && (
                <div className="mb-4 p-3 rounded-xl bg-indigo-50 border border-indigo-100">
                  <p className="text-sm text-indigo-700">
                    <span className="font-semibold">AI Recommendation:</span> Schedule reviews during <span className="font-bold">{peakTime.label}</span> — your scores average {peakTime.avgScore}% during this window.
                  </p>
                </div>
              )}

              {reviewSchedule.length > 0 ? (
                <ul className="space-y-3">
                  {reviewSchedule.map((r) => {
                    const urgencyColor = r.urgency === 'critical' ? 'border-l-red-500 bg-red-50/50' :
                      r.urgency === 'review-soon' ? 'border-l-amber-500 bg-amber-50/50' :
                      'border-l-blue-500 bg-blue-50/50';
                    return (
                      <li key={r.id}
                        className={`flex items-center gap-4 p-4 rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm border-l-4 ${urgencyColor}`}>
                        <div className="w-14 shrink-0 text-center">
                          <div className="text-xs font-semibold text-slate-500 uppercase">{r.date.split(' ')[0]}</div>
                          <div className="text-lg font-bold text-slate-900">{r.date.split(' ')[1]}</div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900">Review: {r.topic}</p>
                          <p className="text-sm text-slate-500">{r.time} · Retention: {r.retention}% · Interval: {r.interval}</p>
                          <p className="text-xs text-slate-400 mt-0.5">Last studied {r.daysSinceStudied}d ago · Original score: {r.originalScore}%</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium ${typeStyles[r.type] || 'bg-slate-100 text-slate-700'}`}>
                            {r.type === 'review' ? 'urgent review' : 'spaced rep'}
                          </span>
                          <button onClick={() => router.push('/watch')}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                            Start Review
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="text-center py-12 bg-white/90 rounded-2xl border border-slate-200/80">
                  <p className="text-lg font-bold text-green-600 mb-2">All caught up!</p>
                  <p className="text-sm text-slate-500">No topics need review right now. Your retention is strong.</p>
                </div>
              )}
            </>
          )}

          {activeTab === 'events' && (
            <ul className="space-y-3">
              {EVENTS.map((e) => (
                <li key={e.id}
                  className="flex items-center gap-4 p-4 rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm">
                  <div className="w-14 shrink-0 text-center">
                    <div className="text-xs font-semibold text-slate-500 uppercase">{e.date.split(' ')[0]}</div>
                    <div className="text-lg font-bold text-slate-900">{e.date.split(' ')[1]}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900">{e.title}</p>
                    <p className="text-sm text-slate-500">{e.time} · {e.location}</p>
                  </div>
                  <span className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium ${typeStyles[e.type] || 'bg-slate-100 text-slate-700'}`}>
                    {e.type}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
