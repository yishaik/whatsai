/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './App.tsx',
    './index.tsx',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
    './data/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'chat-bg': '#090E11',
        'panel-bg': '#101B20',
        'panel-header-bg': '#202C33',
        'item-hover-bg': '#222E35',
        'item-active-bg': '#2A3942',
        'icon-default': '#8696A0',
        'icon-strong': '#AEBAC1',
        'text-primary': '#E9EDEF',
        'text-secondary': '#8696A0',
        'message-out': '#005C4B',
        'message-in': '#202C33',
        'accent-green': '#00A884',
        'accent-blue': '#53BDEB',
      },
    },
  },
  plugins: [],
};
