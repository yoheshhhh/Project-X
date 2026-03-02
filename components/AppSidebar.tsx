'use client';

import Link from 'next/link';

export const SIDEBAR_NAV = [
  { label: 'Institution Page', href: '/institution', icon: '🏛️' },
  { label: 'Activity', href: '/activity', icon: '📊' },
  { label: 'Courses', href: '/course', icon: '🎓' },
  { label: 'Communities', href: '/community', icon: '👥' },
  { label: 'Calendar', href: '/calendar', icon: '📅' },
  { label: 'Messages', href: '/messages', icon: '✉️', badge: 1 },
  { label: 'Grades', href: '/grades', icon: '📝' },
  { label: 'Assist', href: '/assist', icon: '💬' },
  { label: 'Resources', href: '/resources', icon: '📚' },
] as const;

type AppSidebarProps = {
  currentPath: string;
  onSignOut?: () => void;
};

export function AppSidebar({ currentPath, onSignOut }: AppSidebarProps) {
  return (
    <aside className="w-64 min-h-screen flex flex-col shrink-0 bg-white/90 backdrop-blur-xl border-r border-slate-200/80 shadow-lg shadow-slate-200/50">
      <div className="p-5 border-b border-slate-200/80">
        <Link href="/" className="block group">
          <span className="text-xs font-semibold text-slate-500 tracking-wide leading-snug group-hover:text-indigo-600 transition-colors">
            NANYANG TECHNOLOGICAL UNIVERSITY SINGAPORE
          </span>
        </Link>
      </div>
      <div className="p-4 flex items-center gap-3 border-b border-slate-200/80">
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-indigo-500/30 ring-2 ring-white">
          N
        </div>
        <span className="text-sm text-slate-700 font-medium truncate">CCDS Narhen</span>
      </div>
      <nav className="flex-1 py-4 px-2">
        {SIDEBAR_NAV.map((item) => {
          const active = currentPath === item.href;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                active
                  ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-sm border border-indigo-100/80'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {item.icon && <span className="text-base opacity-90">{item.icon}</span>}
              <span>{item.label}</span>
              {item.badge != null && (
                <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-xs flex items-center justify-center font-medium shadow-sm">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-slate-200/80 space-y-1.5">
        <button
          type="button"
          onClick={onSignOut}
          className="block text-xs text-slate-500 hover:text-slate-800 transition-colors"
        >
          Sign Out
        </button>
        {['Privacy', 'Terms', 'Accessibility'].map((label) => (
          <a key={label} href="#" className="block text-xs text-slate-500 hover:text-slate-800 transition-colors">
            {label}
          </a>
        ))}
      </div>
    </aside>
  );
}
