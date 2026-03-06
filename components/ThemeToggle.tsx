'use client';
import { useState, useEffect } from 'react';

export default function ThemeToggle() {
  const [light, setLight] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light') { setLight(true); document.body.classList.add('light-mode'); }
  }, []);

  const toggle = () => {
    const next = !light;
    setLight(next);
    if (next) {
      document.body.classList.add('light-mode');
      localStorage.setItem('theme', 'light');
    } else {
      document.body.classList.remove('light-mode');
      localStorage.setItem('theme', 'dark');
    }
  };

  return (
    <button onClick={toggle} className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all" title={light ? 'Switch to dark mode' : 'Switch to light mode'}>
      {light ? <span className="text-lg">🌙</span> : <span className="text-lg">☀️</span>}
    </button>
  );
}
