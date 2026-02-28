/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Cairo', 'sans-serif'],
                outfit: ['Outfit', 'sans-serif'],
            },
            colors: {
                primary: {
                    50: '#eef2ff',
                    100: '#e0e7ff',
                    200: '#c7d2fe',
                    300: '#a5b4fc',
                    400: '#818cf8',
                    500: '#004aad', // B.Laban Deep Blue
                    600: '#003a8a',
                    700: '#002a66',
                    800: '#001a42',
                    900: '#000a1f',
                },
                brand: {
                    blaban: '#004aad',
                    konafa: '#f58220',
                    basbosa: '#662d91',
                    shaltat: '#4b2c20',
                    whem: '#ed1c24',
                },
                accent: {
                    mint: '#bbf7d0',
                    sky: '#0ea5e9',
                    gold: '#d9b382',
                },
                surface: {
                    50: '#f8fafc',
                    100: '#f1f5f9',
                    200: '#e2e8f0',
                    300: '#cbd5e1',
                    400: '#94a3b8',
                    500: '#64748b',
                    600: '#475569',
                    700: '#334155',
                    800: '#1e293b',
                    900: '#0f172a',
                    950: '#020617',
                    1000: '#01040a', // Deepest Black
                }
            },
            backgroundImage: {
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
                'night-glow': 'radial-gradient(circle at 50% 50%, rgba(0, 74, 173, 0.15), transparent 70%)',
            },
            animation: {
                'pulse-premium': 'pulse-premium 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'glow': 'glow 2s ease-in-out infinite alternate',
            },
            keyframes: {
                'pulse-premium': {
                    '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                    '50%': { opacity: .8, transform: 'scale(1.02)' },
                },
                'glow': {
                    'from': { 'box-shadow': '0 0 5px #004aad, 0 0 10px #004aad' },
                    'to': { 'box-shadow': '0 0 20px #004aad, 0 0 30px #004aad' },
                }
            },
            boxShadow: {
                '3d': '0 4px 0 #003a8a',
                '3d-active': '0 2px 0 #003a8a',
                '3d-success': '0 4px 0 #15803d',
                '3d-error': '0 4px 0 #b91c1c',
                'premium': '0 20px 25px -5px rgb(0 0 0 / 0.5), 0 8px 10px -6px rgb(0 0 0 / 0.5)',
                'inner-glass': 'inset 0 0 0 1px rgba(255, 255, 255, 0.05)',
                'glow-blue': '0 0 15px rgba(0, 74, 173, 0.4)',
            }
        },
    },
    plugins: [],
}
