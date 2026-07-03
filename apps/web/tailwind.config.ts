import type { Config } from 'tailwindcss';

/**
 * Caliber design language — premium, light, institutional-calm SaaS.
 * A cool near-white canvas with soft blue gradient washes, a single confident
 * royal-blue brand accent, hairline-bordered white surfaces, and generous space.
 */
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#f6f8fc',
        ink: {
          900: '#0a0f1e',
          800: '#151b2e',
          700: '#28304a',
        },
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a8bcff',
          400: '#6b83ff',
          500: '#3657d5',
          600: '#2f49b8',
          700: '#273c99',
        },
        signal: {
          amber: '#d97706',
          rose: '#e11d48',
          emerald: '#059669',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,0.04), 0 12px 32px -16px rgba(16,24,40,0.18)',
        soft: '0 1px 2px rgba(16,24,40,0.05)',
        pop: '0 20px 48px -16px rgba(54,87,213,0.30)',
      },
      letterSpacing: {
        tightish: '-0.011em',
        tighter2: '-0.028em',
      },
      backgroundImage: {
        'brand-fade':
          'radial-gradient(60% 60% at 50% 0%, rgba(168,188,255,0.35) 0%, rgba(246,248,252,0) 70%)',
      },
    },
  },
  plugins: [],
};

export default config;
