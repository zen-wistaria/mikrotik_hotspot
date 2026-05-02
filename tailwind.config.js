export default {
  content: ['./src/**/*.{html,js}'],
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
        float: 'float 6s ease-in-out infinite',
        'scan-pulse': 'scanPulse 2s ease-in-out infinite',
        'scan-line': 'scanLine 3s ease-in-out infinite',
        'slide-in': 'slideIn 0.25s ease',
      },
      keyframes: {
        scanPulse: {
          '0%, 100%': { opacity: '0.5', borderColor: '#38BDF8' },
          '50%': { opacity: '1', borderColor: '#BAE6FD' },
        },
        scanLine: {
          '0%': { top: '15%', opacity: '0' },
          '10%': { opacity: '0.8' },
          '50%': { top: '85%', opacity: '0.8' },
          '90%': { opacity: '0.5' },
          '100%': { top: '15%', opacity: '0' },
        },
        slideIn: {
          'from': { opacity: '0', transform: 'translateY(12px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
};
