module.exports = {
  content: [
    "./src/**/*.html",
    "./src/**/*.js",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'neon-blue': '#00d2ff',
        'neon-purple': '#9d50bb',
        'dark-primary': '#0a0b10',
        'dark-secondary': '#1a1b23',
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        'glow-pulse': 'glowPulse 2s infinite ease-in-out',
        'float': 'float 6s ease-in-out infinite',
      },
    },
  },
}