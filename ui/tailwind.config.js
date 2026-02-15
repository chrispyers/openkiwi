import typography from '@tailwindcss/typography'

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
        },
    },
    plugins: [
        typography,
    ],
}
