'use client';

import { useEffect, useState } from 'react';

function SunMoon({ dark }: { dark: boolean }) {
  return dark ? (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  ) : (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 12.8A8.5 8.5 0 1111.2 3a6.5 6.5 0 009.8 9.8z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ThemeToggle({ variant = 'icon' }: { variant?: 'icon' | 'nav' }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
  };

  const label = dark ? 'Light mode' : 'Dark mode';

  if (variant === 'nav') {
    return (
      <button
        onClick={toggle}
        aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-ink-900"
      >
        <SunMoon dark={dark} />
        {label}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`}
      title={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-900/10 bg-white text-slate-500 transition hover:text-ink-900"
    >
      <SunMoon dark={dark} />
    </button>
  );
}
