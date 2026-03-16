/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dhaba: {
          bg: 'hsl(var(--dhaba-bg))',
          surface: 'hsl(var(--dhaba-surface))',
          'surface-hover': 'hsl(var(--dhaba-surface-hover))',
          card: 'hsl(var(--dhaba-card))',
          border: 'hsl(var(--dhaba-border))',
          text: 'hsl(var(--dhaba-text))',
          muted: 'hsl(var(--dhaba-muted))',
          accent: 'hsl(var(--dhaba-accent))',
          'accent-hover': 'hsl(var(--dhaba-accent-hover))',
          'accent-glow': 'hsl(var(--dhaba-accent-glow))',
          orange: 'hsl(var(--dhaba-orange))',
          success: 'hsl(var(--dhaba-success))',
          danger: 'hsl(var(--dhaba-danger))',
          info: 'hsl(var(--dhaba-info))',
        },
      },
      fontFamily: {
        display: ['Montserrat', 'serif'],
        body: ['DM Sans', 'sans-serif'],
      },
      boxShadow: {
        'glow': '0 0 20px -5px hsl(var(--dhaba-accent) / 0.4)',
        'glow-lg': '0 0 40px -10px hsl(var(--dhaba-accent) / 0.3)',
        'card': '0 4px 24px -4px hsl(0 0% 0% / 0.5)',
        'elevated': '0 8px 32px -8px hsl(0 0% 0% / 0.6)',
      },
      backgroundImage: {
        'gradient-warm': 'linear-gradient(135deg, hsl(var(--dhaba-accent)), hsl(var(--dhaba-orange)))',
        'gradient-dark': 'linear-gradient(180deg, hsl(var(--dhaba-bg)), hsl(var(--dhaba-surface)))',
        'gradient-card': 'linear-gradient(145deg, hsl(var(--dhaba-surface)), hsl(var(--dhaba-card)))',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [
    import('tailwind-scrollbar-hide'),
  ],
}
