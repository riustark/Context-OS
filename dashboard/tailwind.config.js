/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#f8fafc',
        'bg-card': '#ffffff',
        'text-primary': '#0f172a',
        'text-secondary': '#475569',
        'border': '#e2e8f0',
        'accent': '#6366f1',
      },
    },
  },
  plugins: [],
};
