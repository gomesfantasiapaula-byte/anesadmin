import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // ── Paleta WHOOP ──────────────────────────────────────────────
      colors: {
        background: '#0a0a0a',
        surface: '#141414',
        'surface-elevated': '#1c1c1c',
        border: '#2a2a2a',
        'accent-primary': '#00d4aa',
        'accent-secondary': '#7c3aed',
        'text-primary': '#ffffff',
        'text-secondary': '#8a8a8a',
        success: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444',
      },
      // ── Tipografía ────────────────────────────────────────────────
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontWeight: {
        metric: '800',
      },
      // ── Animaciones suaves estilo WHOOP ───────────────────────────
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(0, 212, 170, 0.4)' },
          '50%': { boxShadow: '0 0 0 8px rgba(0, 212, 170, 0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        shimmer: 'shimmer 1.5s infinite',
      },
      // ── Background gradients ───────────────────────────────────────
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        shimmer:
          'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)',
      },
    },
  },
  plugins: [],
}

export default config
