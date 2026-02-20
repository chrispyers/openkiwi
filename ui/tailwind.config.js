import typography from '@tailwindcss/typography'
import tailwindAnimate from 'tailwindcss-animate'

/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class', // Enable class-based dark mode
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'accent-primary': 'var(--accent-primary)',
                'bg-sidebar': 'var(--bg-sidebar)',
                'bg-primary': 'var(--bg-primary)',
                'bg-card': 'var(--bg-card)',
                'text-primary': 'var(--text-primary)',
                'text-secondary': 'var(--text-secondary)',
                'border-color': 'var(--border-color)',
            },
            keyframes: {
                'fade-in': {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                'fade-in-up': {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
            },
            animation: {
                'fade-in': 'fade-in 0.5s ease-out',
                'fade-in-up': 'fade-in-up 0.5s ease-out',
            },
        },
    },
    plugins: [
        typography,
        tailwindAnimate,
    ],
}
