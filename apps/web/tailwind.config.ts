import type { Config } from 'tailwindcss';

/**
 * Helm design language: institutional, calm, premium. A deep slate/ink base
 * with a single restrained teal accent ("helm") and a warm signal amber for
 * risk states. No neon, no noise.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0a0e14',
          900: '#0f141c',
          800: '#161d28',
          700: '#1f2937',
          600: '#374151',
        },
        helm: {
          400: '#5eead4',
          500: '#2dd4bf',
          600: '#14b8a6',
          700: '#0f8a80',
        },
        signal: {
          amber: '#f0b429',
          rose: '#e0607e',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        panel: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 12px 40px -12px rgba(0,0,0,0.6)',
      },
      backgroundImage: {
        'grid-faint':
          'linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
};

export default config;
