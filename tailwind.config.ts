import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      keyframes: {
        'color-shift': {
          '0%, 100%': {
            'background-color': '#60a5fa' // blue-400
          },
          '50%': {
            'background-color': '#3b82f6' // blue-500
          },
        },
      },
      animation: {
        'color-shift': 'color-shift .5s ease infinite',
      },
    },
  },
  plugins: [],
}

export default config 