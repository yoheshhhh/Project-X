'use client';

import AuthGuard from '@/components/AuthGuard';
import { useState, useEffect, useCallback } from 'react';
import { useStudentData } from '@/lib/useStudentData';
import { auth, saveStudyProfile, getStudyProfile, findStudyMatches } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

const mockPosts = [
  {
    id: 1,
    title: 'How do nested if-else statements work?',
    body: 'I keep getting confused with the indentation and which else belongs to which if. Can someone explain with a simple example?',
    author: 'Anonymous Owl',
    anonymous: true,
    module: 'SC1003',
    topic: 'Control Structures',
    upvotes: 12,
    downvotes: 1,
    replies: [
      {
        id: 'r1',
        author: 'Arun M.',
        body: 'Think of it like nesting boxes. Each if opens a box, and the else closes the nearest open box. Indentation helps you see which box you are in!',
        upvotes: 8,
        isAI: false,
      },
      {
        id: 'r2',
        author: '🤖 AI Tutor',
        body: 'Great question! Nested if-else works from the inside out. The innermost if-else pair resolves first. Think of it like Russian nesting dolls — each doll (if) has its own matching lid (else). A tip: always use curly braces {} even for single-line blocks to avoid confusion.',
        upvotes: 5,
        isAI: true,
      },
    ],
    solved: true,
    timestamp: '2 hours ago',
    studyGroup: null,
  },
  {
    id: 2,
    title: 'Anyone want to study loops together before the quiz?',
    body: 'I am struggling with for vs while loops. Looking for 2-3 people to do a study session tomorrow evening around 7pm. We can meet at The Hive or do it on Zoom.',
    author: 'Pranati S.',
    anonymous: false,
    module: 'SC1003',
    topic: 'Loops',
    upvotes: 18,
    downvotes: 0,
    replies: [
      { id: 'r3', author: 'Yohesh R.', body: 'Count me in! I also struggle with do-while. Zoom works for me.', upvotes: 3, isAI: false },
      { id: 'r4', author: 'Nanda K.', body: 'I am in too. Let us do The Hive Level 3?', upvotes: 2, isAI: false },
    ],
    solved: false,
    timestamp: '5 hours ago',
    studyGroup: { date: 'Tomorrow 7pm', location: 'The Hive L3 / Zoom', spots: 4, joined: 2 },
  },
  {
    id: 3,
    title: 'What is the difference between break and continue?',
    body: 'Both seem to skip something in loops but I cannot figure out when to use which one.',
    author: 'Anonymous Fox',
    anonymous: true,
    module: 'SC1003',
    topic: 'Loops',
    upvotes: 9,
    downvotes: 0,
    replies: [
      {
        id: 'r5',
        author: '🤖 AI Tutor',
        body: 'Break exits the entire loop immediately — like walking out of a movie theater. Continue skips just the current iteration and moves to the next one — like fast-forwarding past one scene but keeping watching. Use break when you have found what you need. Use continue when you want to skip certain items but keep processing the rest.',
        upvotes: 7,
        isAI: true,
      },
    ],
    solved: true,
    timestamp: '1 day ago',
    studyGroup: null,
  },
  {
    id: 4,
    title: 'Study group for Module 3: Functions',
    body: 'Starting Module 3 next week. Want to form a weekly study group to go through it together. Planning to meet every Wednesday at 6pm.',
    author: 'Narhen K.',
    anonymous: false,
    module: 'SC1003',
    topic: 'Functions',
    upvotes: 15,
    downvotes: 0,
    replies: [{ id: 'r6', author: 'Anonymous Tiger', body: 'Yes please! Functions are tough. Wednesday works.', upvotes: 4, isAI: false }],
    solved: false,
    timestamp: '1 day ago',
    studyGroup: { date: 'Every Wed 6pm', location: 'TBD', spots: 6, joined: 3 },
  },
];

const modules = ['All', 'SC1003', 'SC1005', 'SC2006', 'MH1812'];
const topics = ['All', 'Control Structures', 'Loops', 'Functions', 'Arrays', 'Recursion'];

export default function CommunityPage() {
  const [posts, setPosts] = useState<any[]>(mockPosts);
  const [filterModule, setFilterModule] = useState('All');
  const [filterTopic, setFilterTopic] = useState('All');
  const [showNew, setShowNew] = useState(false);
  const [showReplying, setShowReplying] = useState<number | null>(null);
  const [expandedPost, setExpandedPost] = useState<number | null>(null);
  const [voted, setVoted] = useState<Record<string, boolean>>({});

  // Study Matcher state
  const { studentData } = useStudentData();
  const [showMatcher, setShowMatcher] = useState(false);
  const [matcherOptedIn, setMatcherOptedIn] = useState(false);
  const [matches, setMatches] = useState<any[]>([]);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchProfile, setMatchProfile] = useState<any>(null);

  const weakTopics = studentData?.weakTopics || [];
  const strongTopics = studentData?.strongTopics || [];

  const loadMatcherData = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const profile = await getStudyProfile(user.uid);
      if (profile) {
        setMatchProfile(profile);
        setMatcherOptedIn(!!(profile as any).optIn);
      }
    } catch { /* ignore */ }
  }, []);

  const handleOptIn = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setMatchLoading(true);
    try {
      await saveStudyProfile(user.uid, {
        displayName: user.displayName || 'Student',
        weakTopics,
        strongTopics,
        studyStyle: studentData?.learningStyle || 'Unknown',
        lookingForHelp: weakTopics,
        canHelpWith: strongTopics,
        optIn: true,
      });
      setMatcherOptedIn(true);
      // Find matches
      const found = await findStudyMatches(user.uid, weakTopics);
      setMatches(found);
    } catch { /* ignore */ }
    setMatchLoading(false);
  };

  const handleFindMatches = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setMatchLoading(true);
    try {
      // Update profile with latest data
      await saveStudyProfile(user.uid, {
        displayName: user.displayName || 'Student',
        weakTopics,
        strongTopics,
        studyStyle: studentData?.learningStyle || 'Unknown',
        lookingForHelp: weakTopics,
        canHelpWith: strongTopics,
        optIn: true,
      });
      const found = await findStudyMatches(user.uid, weakTopics);
      setMatches(found);
    } catch { /* ignore */ }
    setMatchLoading(false);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) loadMatcherData();
    });
    return () => unsub();
  }, [loadMatcherData]);

  // New post form
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newModule, setNewModule] = useState('SC1003');
  const [newTopic, setNewTopic] = useState('Control Structures');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isStudyGroup, setIsStudyGroup] = useState(false);
  const [groupDate, setGroupDate] = useState('');
  const [groupLocation, setGroupLocation] = useState('');
  const [groupSpots, setGroupSpots] = useState(4);

  // Reply form
  const [replyText, setReplyText] = useState('');
  const [replyAnonymous, setReplyAnonymous] = useState(false);

  // AI reply
  const [aiLoading, setAiLoading] = useState<number | null>(null);

  const filtered = posts.filter((p) => {
    if (filterModule !== 'All' && p.module !== filterModule) return false;
    if (filterTopic !== 'All' && p.topic !== filterTopic) return false;
    return true;
  });

  const handleVote = (postId: number, type: 'up' | 'down') => {
    const key = `${postId}-${type}`;
    if (voted[key]) return;

    setVoted((prev) => ({ ...prev, [key]: true }));

    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const field = type === 'up' ? 'upvotes' : 'downvotes';
        return { ...p, [field]: (p[field] ?? 0) + 1 };
      })
    );
  };

  const handleNewPost = () => {
    const post = {
      id: posts.length + 1,
      title: newTitle,
      body: newBody,
      author: isAnonymous ? 'Anonymous ' + ['Owl', 'Fox', 'Tiger', 'Panda', 'Eagle'][Math.floor(Math.random() * 5)] : 'You',
      anonymous: isAnonymous,
      module: newModule,
      topic: newTopic,
      upvotes: 0,
      downvotes: 0,
      replies: [],
      solved: false,
      timestamp: 'Just now',
      studyGroup: isStudyGroup ? { date: groupDate, location: groupLocation, spots: groupSpots, joined: 1 } : null,
    };

    setPosts((prev) => [post, ...prev]);
    setShowNew(false);
    setNewTitle('');
    setNewBody('');
    setIsAnonymous(false);
    setIsStudyGroup(false);
    setGroupDate('');
    setGroupLocation('');
    setGroupSpots(4);
  };

  const handleReply = (postId: number) => {
    const reply = {
      id: 'r' + Date.now(),
      author: replyAnonymous ? 'Anonymous ' + ['Deer', 'Wolf', 'Bear'][Math.floor(Math.random() * 3)] : 'You',
      body: replyText,
      upvotes: 0,
      isAI: false,
    };

    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, replies: [...p.replies, reply] } : p))
    );

    setReplyText('');
    setShowReplying(null);
    setReplyAnonymous(false);
  };

  const handleAIReply = async (postId: number) => {
    setAiLoading(postId);
    const post = posts.find((p) => p.id === postId);

    try {
      const res = await fetch('/api/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: post.module + ' ' + post.topic,
          segmentTitle: post.title,
          segmentContent: post.body + ' ' + post.replies.map((r: any) => r.body).join(' '),
          timestamp: 'community',
        }),
      });

      const data = await res.json();

      const aiReply = {
        id: 'ai' + Date.now(),
        author: '🤖 AI Tutor',
        body:
          data.summary ||
          'I can help with this! The key concept here involves understanding the fundamentals step by step. Try breaking the problem into smaller parts.',
        upvotes: 0,
        isAI: true,
      };

      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, replies: [...p.replies, aiReply] } : p))
      );
    } catch {
      const aiReply = {
        id: 'ai' + Date.now(),
        author: '🤖 AI Tutor',
        body: 'Try breaking this problem into smaller parts. Review the lecture materials for this topic and practice with simple examples first.',
        upvotes: 0,
        isAI: true,
      };

      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, replies: [...p.replies, aiReply] } : p))
      );
    }

    setAiLoading(null);
  };

  const toggleSolved = (postId: number) => {
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, solved: !p.solved } : p)));
  };

  const joinStudyGroup = (postId: number) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId || !p.studyGroup) return p;
        // Prevent over-joining
        if (p.studyGroup.joined >= p.studyGroup.spots) return p;
        return { ...p, studyGroup: { ...p.studyGroup, joined: p.studyGroup.joined + 1 } };
      })
    );
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
        {/* Header */}
        <div className="border-b border-white/10 bg-white/5 backdrop-blur-xl">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-extrabold text-white">
                NTU<span className="text-blue-400">learn</span>
              </h1>
              <span className="text-slate-500">|</span>
              <span className="text-sm text-slate-300">Community Forum</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => (window.location.href = '/dashboard')}
                className="bg-white/10 hover:bg-white/20 text-white text-sm px-4 py-2 rounded-lg transition-all"
              >
                Dashboard
              </button>
              <button
                onClick={() => (window.location.href = '/course')}
                className="bg-white/10 hover:bg-white/20 text-white text-sm px-4 py-2 rounded-lg transition-all"
              >
                Course
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-6">
          {/* Top Bar */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Study Community 💬</h2>
              <p className="text-sm text-slate-400 mt-1">Ask questions, help peers, form study groups</p>
            </div>
            <button
              onClick={() => setShowNew(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-5 py-2.5 rounded-xl transition-all hover:shadow-lg hover:shadow-blue-500/25"
            >
              + New Post
            </button>
          </div>

          {/* Filters */}
          <div className="flex gap-3 mb-6 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Module:</span>
              {modules.map((m) => (
                <button
                  key={m}
                  onClick={() => setFilterModule(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    filterModule === m ? 'bg-blue-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Topic:</span>
              {topics.map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterTopic(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    filterTopic === t ? 'bg-violet-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* AI Study Matcher */}
          <div className="mb-6 bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  🤝 AI Study Matcher
                  <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full">ML-Powered</span>
                </h3>
                <p className="text-sm text-slate-400 mt-1">Find study partners whose strengths complement your weak topics</p>
              </div>
              <button onClick={() => setShowMatcher(!showMatcher)}
                className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-sm px-4 py-2 rounded-lg transition-all">
                {showMatcher ? 'Hide' : 'Find Partners'}
              </button>
            </div>

            {showMatcher && (
              <div className="mt-4">
                {/* Your profile summary */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-xs text-slate-400 mb-1">You need help with:</p>
                    <div className="flex flex-wrap gap-1">
                      {weakTopics.length > 0 ? weakTopics.map((t: string) => (
                        <span key={t} className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">{t}</span>
                      )) : <span className="text-xs text-slate-500">No weak topics detected</span>}
                    </div>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-xs text-slate-400 mb-1">You can help with:</p>
                    <div className="flex flex-wrap gap-1">
                      {strongTopics.length > 0 ? strongTopics.map((t: string) => (
                        <span key={t} className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full">{t}</span>
                      )) : <span className="text-xs text-slate-500">No strong topics yet</span>}
                    </div>
                  </div>
                </div>

                {!matcherOptedIn ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-slate-300 mb-3">Opt in to let AI match you with complementary study partners. Your topic strengths/weaknesses are shared anonymously.</p>
                    <button onClick={handleOptIn} disabled={matchLoading}
                      className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white font-semibold px-6 py-2.5 rounded-xl transition-all">
                      {matchLoading ? 'Finding matches...' : 'Opt In & Find Matches'}
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm text-emerald-300 font-medium">Matched Study Partners</p>
                      <button onClick={handleFindMatches} disabled={matchLoading}
                        className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition-all">
                        {matchLoading ? 'Searching...' : 'Refresh Matches'}
                      </button>
                    </div>
                    {matches.length > 0 ? (
                      <div className="space-y-2">
                        {matches.slice(0, 5).map((m: any, i: number) => (
                          <div key={i} className="p-3 bg-white/5 rounded-xl flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-white">{m.displayName || 'Student'}</p>
                              <p className="text-xs text-slate-400">Style: {m.studyStyle || 'Unknown'}</p>
                              {m.canHelpWith && m.canHelpWith.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  <span className="text-xs text-slate-500">Can help you with:</span>
                                  {m.canHelpWith.map((t: string) => (
                                    <span key={t} className="text-xs bg-green-500/20 text-green-300 px-1.5 py-0.5 rounded-full">{t}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">
                                {Math.round(m.matchScore * 20)}% match
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 text-center py-3">
                        {matchLoading ? 'Searching for compatible study partners...' : 'No matches found yet. More students need to opt in!'}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* New Post Modal */}
          {showNew && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
              <h3 className="text-lg font-bold text-white mb-4">Create New Post</h3>
              <div className="space-y-4">
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Question or topic title..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
                <textarea
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  placeholder="Describe your question or study group details..."
                  rows={4}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                />
                <div className="flex gap-4">
                  <select
                    value={newModule}
                    onChange={(e) => setNewModule(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm"
                  >
                    {modules
                      .filter((m) => m !== 'All')
                      .map((m) => (
                        <option key={m} value={m} className="bg-slate-800">
                          {m}
                        </option>
                      ))}
                  </select>
                  <select
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm"
                  >
                    {topics
                      .filter((t) => t !== 'All')
                      .map((t) => (
                        <option key={t} value={t} className="bg-slate-800">
                          {t}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Toggles */}
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} className="w-4 h-4 rounded" />
                    <span className="text-sm text-slate-300">🎭 Post anonymously</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={isStudyGroup} onChange={(e) => setIsStudyGroup(e.target.checked)} className="w-4 h-4 rounded" />
                    <span className="text-sm text-slate-300">👥 This is a study group invite</span>
                  </label>
                </div>

                {/* Study Group Details */}
                {isStudyGroup && (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 space-y-3">
                    <p className="text-sm font-medium text-green-300">Study Group Details</p>
                    <input
                      value={groupDate}
                      onChange={(e) => setGroupDate(e.target.value)}
                      placeholder="When? (e.g. Tomorrow 7pm)"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500"
                    />
                    <input
                      value={groupLocation}
                      onChange={(e) => setGroupLocation(e.target.value)}
                      placeholder="Where? (e.g. The Hive L3 / Zoom)"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-400">Max spots:</span>
                      <input
                        type="number"
                        value={groupSpots}
                        onChange={(e) => setGroupSpots(parseInt(e.target.value || '4', 10))}
                        min={2}
                        max={20}
                        className="w-20 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleNewPost}
                    disabled={!newTitle || !newBody}
                    className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white font-semibold px-6 py-2.5 rounded-xl transition-all"
                  >
                    Post
                  </button>
                  <button
                    onClick={() => setShowNew(false)}
                    className="bg-white/10 hover:bg-white/20 text-white px-6 py-2.5 rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Posts List */}
          <div className="space-y-4">
            {filtered.map((post) => (
              <div key={post.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                <div className="p-6">
                  <div className="flex gap-4">
                    {/* Vote Column */}
                    <div className="flex flex-col items-center gap-1 min-w-[40px]">
                      <button
                        onClick={() => handleVote(post.id, 'up')}
                        className={`text-lg hover:scale-125 transition-transform ${
                          voted[`${post.id}-up`] ? 'text-green-400' : 'text-slate-500'
                        }`}
                      >
                        ▲
                      </button>
                      <span className="text-sm font-bold text-white">{post.upvotes - post.downvotes}</span>
                      <button
                        onClick={() => handleVote(post.id, 'down')}
                        className={`text-lg hover:scale-125 transition-transform ${
                          voted[`${post.id}-down`] ? 'text-red-400' : 'text-slate-500'
                        }`}
                      >
                        ▼
                      </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="bg-blue-500/20 text-blue-300 text-xs px-2 py-0.5 rounded-full">{post.module}</span>
                        <span className="bg-violet-500/20 text-violet-300 text-xs px-2 py-0.5 rounded-full">{post.topic}</span>
                        {post.solved && <span className="bg-green-500/20 text-green-300 text-xs px-2 py-0.5 rounded-full">✅ Solved</span>}
                        {post.studyGroup && <span className="bg-amber-500/20 text-amber-300 text-xs px-2 py-0.5 rounded-full">👥 Study Group</span>}
                        {post.anonymous && <span className="bg-slate-500/20 text-slate-400 text-xs px-2 py-0.5 rounded-full">🎭 Anonymous</span>}
                      </div>

                      <h3
                        className="text-lg font-bold text-white mb-1 cursor-pointer hover:text-blue-300 transition-colors"
                        onClick={() => setExpandedPost(expandedPost === post.id ? null : post.id)}
                      >
                        {post.title}
                      </h3>

                      <p className="text-sm text-slate-400 mb-3">{post.body}</p>

                      {/* Study Group Card */}
                      {post.studyGroup && (
                        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-green-300">📅 {post.studyGroup.date}</p>
                              <p className="text-sm text-green-200">📍 {post.studyGroup.location}</p>
                              <p className="text-xs text-green-400 mt-1">
                                {post.studyGroup.joined}/{post.studyGroup.spots} joined
                              </p>
                            </div>
                            <button
                              onClick={() => joinStudyGroup(post.id)}
                              className="bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all"
                            >
                              Join Group
                            </button>
                          </div>

                          <div className="h-1.5 bg-white/10 rounded-full mt-3 overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full transition-all"
                              style={{ width: `${(post.studyGroup.joined / post.studyGroup.spots) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Meta */}
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>{post.author}</span>
                        <span>{post.timestamp}</span>
                        <span>{post.replies.length} replies</span>
                        <button
                          onClick={() => setExpandedPost(expandedPost === post.id ? null : post.id)}
                          className="text-blue-400 hover:text-blue-300"
                        >
                          {expandedPost === post.id ? 'Hide replies' : 'Show replies'}
                        </button>
                        <button onClick={() => toggleSolved(post.id)} className="text-green-400 hover:text-green-300">
                          {post.solved ? 'Unmark solved' : 'Mark solved'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Replies */}
                {expandedPost === post.id && (
                  <div className="border-t border-white/10 bg-white/[0.02] px-6 py-4">
                    {post.replies.map((reply: any) => (
                      <div
                        key={reply.id}
                        className={`p-4 rounded-xl mb-3 ${
                          reply.isAI ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-white/5 border border-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-sm font-medium ${reply.isAI ? 'text-blue-300' : 'text-slate-300'}`}>
                            {reply.author}
                          </span>
                          {reply.isAI && (
                            <span className="bg-blue-500/20 text-blue-300 text-xs px-2 py-0.5 rounded-full">
                              AI Generated
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-300 leading-relaxed">{reply.body}</p>
                      </div>
                    ))}

                    {/* Reply Actions */}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => setShowReplying(showReplying === post.id ? null : post.id)}
                        className="bg-white/10 hover:bg-white/20 text-white text-sm px-4 py-2 rounded-lg transition-all"
                      >
                        💬 Reply
                      </button>
                      <button
                        onClick={() => handleAIReply(post.id)}
                        disabled={aiLoading === post.id}
                        className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-sm px-4 py-2 rounded-lg transition-all"
                      >
                        {aiLoading === post.id ? '⏳ AI thinking...' : '🤖 Ask AI to answer'}
                      </button>
                    </div>

                    {/* Reply Form */}
                    {showReplying === post.id && (
                      <div className="mt-3 space-y-3">
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Write your reply..."
                          rows={3}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                        />
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={replyAnonymous}
                              onChange={(e) => setReplyAnonymous(e.target.checked)}
                              className="w-4 h-4 rounded"
                            />
                            <span className="text-xs text-slate-400">🎭 Reply anonymously</span>
                          </label>
                          <button
                            onClick={() => handleReply(post.id)}
                            disabled={!replyText}
                            className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white text-sm px-4 py-2 rounded-lg transition-all"
                          >
                            Post Reply
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">🔍</div>
              <p className="text-slate-400">No posts found for this filter. Be the first to post!</p>
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}