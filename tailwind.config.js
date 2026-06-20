export default {
  content: ['./src/**/*.{html,js}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        orbitron: ['Orbitron', 'sans-serif'],
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        float: 'float 6s ease-in-out infinite',
        'scan-pulse': 'scanPulse 2s ease-in-out infinite',
        'scan-line': 'scanLine 3s ease-in-out infinite',
        'slide-in': 'slideIn 0.25s ease',
      },
      keyframes: {
        fadeInUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        scanPulse: {
          '0%, 100%': { opacity: '0.5', borderColor: '#6B7280' },
          '50%': { opacity: '1', borderColor: '#9CA3AF' },
        },
        scanLine: {
          '0%': { top: '15%', opacity: '0' },
          '10%': { opacity: '0.8' },
          '50%': { top: '85%', opacity: '0.8' },
          '90%': { opacity: '0.5' },
          '100%': { top: '15%', opacity: '0' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
};
