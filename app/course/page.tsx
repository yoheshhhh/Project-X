'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const NAV_ITEMS = [
  { label: 'Institution Page', href: '#' },
  { label: 'Activity', href: '#' },
  { label: 'Courses', href: '/course', active: true, icon: '🎓' },
  { label: 'Communities', href: '#' },
  { label: 'Calendar', href: '#' },
  { label: 'Messages', href: '#', badge: 1 },
  { label: 'Grades', href: '#' },
  { label: 'Assist', href: '#' },
  { label: 'Resources', href: '#' },
];

const MOCK_COURSES = [
  { id: '1', code: '2552-CC0006-LEC-LE', title: 'SUSTAINABILITY: SOC, ECON, ENV', status: 'Open', instructor: 'Multiple Instructors', image: 'https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=400&h=220&fit=crop' },
  { id: '2', code: '2552-SC2207-CZ2007', title: 'INTRODUCTION TO DATABASES', status: 'Open', instructor: 'CCDS W. K. Ng', image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=220&fit=crop' },
  { id: '3', code: '2552-SC2207-CZ2007', title: 'INTRODUCTION TO DATABASES (LAB)', status: 'Open', instructor: 'CCDS Zhang Tianwei', image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&h=220&fit=crop' },
  { id: '4', code: '2552-SC2207-CZ2007', title: 'INTRODUCTION TO DATABASES (TUT)', status: 'Open', instructor: 'CCDS Zhang Tianwei', image: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=400&h=220&fit=crop' },
  { id: '5', code: '2552-SC0001', title: 'COMPUTER SECURITY', status: 'Open', instructor: 'CCDS LI YI', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=220&fit=crop' },
  { id: '6', code: '2552-CC0001', title: 'CAPSTONE PROJECT', status: 'Open', instructor: 'Multiple Instructors', image: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=400&h=220&fit=crop' },
  { id: '7', code: '2552-SC0002', title: 'SOFTWARE SECURITY', status: 'Open', instructor: 'CCDS W. K. Ng', image: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=400&h=220&fit=crop' },
  { id: '8', code: '2552-CC0006-LEC-ALL', title: 'SUSTAINABILITY: SOC, ECON & ENVT (LEC-ALL) AY2025/26 SEM 2', status: 'Open', instructor: 'Multiple Instructors', image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=220&fit=crop' },
];

export default function CoursePage() {
  const router = useRouter();
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('2552');
  const [filter, setFilter] = useState('All courses');
  const [perPage, setPerPage] = useState(25);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const handleSignOut = () => router.push('/');

  const filtered = MOCK_COURSES.filter(
    (c) =>
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase())
  );
  const count = filtered.length;

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      {/* Left sidebar */}
      <aside className="w-64 min-h-screen flex flex-col shrink-0 bg-white/80 backdrop-blur-xl border-r border-slate-200/60 shadow-sm">
        <div className="p-5 border-b border-slate-100">
          <Link href="/" className="block group">
            <span className="text-xs font-semibold text-slate-600 tracking-wide leading-snug group-hover:text-slate-900 transition-colors">
              NANYANG TECHNOLOGICAL UNIVERSITY SINGAPORE
            </span>
          </Link>
        </div>
        <div className="p-4 flex items-center gap-3 border-b border-slate-100">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-semibold shadow-lg shadow-blue-500/25 ring-2 ring-white">
            A
          </div>
          <span className="text-sm text-slate-700 font-medium truncate">CCDS ARUNKUM...</span>
        </div>
        <nav className="flex-1 py-4 px-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                item.active
                  ? 'bg-blue-50 text-blue-700 font-medium shadow-sm shadow-blue-500/5 border border-blue-100/50'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
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
          ))}
        </nav>
        <div className="p-4 border-t border-slate-100 space-y-1.5">
          <button type="button" onClick={handleSignOut} className="block text-xs text-slate-400 hover:text-slate-600 transition-colors">
            Sign Out
          </button>
          {['Privacy', 'Terms', 'Accessibility'].map((label) => (
            <a key={label} href="#" className="block text-xs text-slate-400 hover:text-slate-600 transition-colors">
              {label}
            </a>
          ))}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="min-h-full">
          <div className="max-w-6xl mx-auto px-6 py-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Courses</h1>
                <p className="text-slate-500 text-sm mt-1">Browse and manage your courses</p>
              </div>
              <a
                href="#"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 text-sm font-medium shadow-sm transition-all duration-200"
              >
                <span className="text-lg">📚</span>
                Course Catalogue
              </a>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3 mb-8 p-4 rounded-2xl bg-white/70 backdrop-blur-sm border border-slate-200/60 shadow-sm">
              <div className="flex items-center gap-0.5 p-1 bg-slate-100 rounded-xl">
                <button
                  onClick={() => setView('grid')}
                  className={`p-2.5 rounded-lg transition-all duration-200 ${view === 'grid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  title="Grid view"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setView('list')}
                  className={`p-2.5 rounded-lg transition-all duration-200 ${view === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  title="List view"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 5a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V9zm0 5a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              <span className="text-sm text-slate-500 font-medium">{count} results</span>
              {term && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium border border-blue-100">
                  {term}
                  <button onClick={() => setTerm('')} className="hover:text-blue-900 transition-colors" aria-label="Clear term">
                    ×
                  </button>
                </span>
              )}
              <div className="flex-1 min-w-[220px] max-w-md">
                <div className="relative group">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </span>
                  <input
                    type="search"
                    placeholder="Search your courses"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all duration-200"
                  />
                </div>
              </div>
              <select
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all cursor-pointer"
              >
                <option value="2552">2552</option>
                <option value="2551">2551</option>
                <option value="2550">2550</option>
              </select>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all cursor-pointer"
              >
                <option>All courses</option>
                <option>Enrolled</option>
                <option>Past</option>
              </select>
              <select
                value={perPage}
                onChange={(e) => setPerPage(Number(e.target.value))}
                className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all cursor-pointer"
              >
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
              </select>
            </div>

            {/* Course grid */}
            <div
              className={
                view === 'grid'
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
                  : 'flex flex-col gap-4'
              }
            >
              {filtered.slice(0, perPage).map((course) => {
                const isComputerSecurity = course.id === '5';
                const articleEl = (
                <article
                  key={course.id}
                  className={`group bg-white rounded-2xl overflow-hidden border border-slate-200/80 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 hover:border-slate-200 transition-all duration-300 ${isComputerSecurity ? 'cursor-pointer' : ''} ${
                    view === 'list' ? 'flex gap-5 p-5' : ''
                  }`}
                >
                  <div
                    className={`relative bg-slate-200 overflow-hidden ${
                      view === 'grid' ? 'h-40' : 'w-44 h-32 shrink-0 rounded-xl'
                    }`}
                  >
                    <img
                      src={course.image}
                      alt=""
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    {view === 'grid' && (
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(course.id); }}
                        className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-white/95 shadow-md flex items-center justify-center text-slate-400 hover:text-amber-500 hover:scale-110 transition-all duration-200 backdrop-blur-sm"
                        aria-label="Toggle favorite"
                      >
                        {favorites.has(course.id) ? (
                          <svg className="w-5 h-5 fill-amber-500 text-amber-500" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                  <div className="p-5 flex flex-col min-w-0">
                    <p className="text-xs text-slate-400 font-mono mb-1.5 truncate">{course.code}</p>
                    <h2 className="text-sm font-semibold text-slate-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">{course.title}</h2>
                    <span className="inline-flex w-fit px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-100 mb-3">
                      {course.status}
                    </span>
                    {isComputerSecurity ? (
                      <span className="text-xs text-blue-600 font-medium truncate">{course.instructor}</span>
                    ) : (
                      <a href="#" className="text-xs text-blue-600 hover:text-blue-700 font-medium truncate">
                        {course.instructor}
                      </a>
                    )}
                    {view === 'list' && (
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(course.id); }}
                        className="mt-3 self-start p-2 rounded-full text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition-all duration-200"
                        aria-label="Toggle favorite"
                      >
                        {favorites.has(course.id) ? (
                          <svg className="w-5 h-5 fill-amber-500" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                        )}
                      </button>
                    )}
                  </div>
                </article>
                );
                return isComputerSecurity ? (
                  <Link href="/watch" className="block" key={course.id}>
                    {articleEl}
                  </Link>
                ) : (
                  articleEl
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
