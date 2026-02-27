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
                }
            },
            boxShadow: {
                '3d': '0 4px 0 #003a8a',
                '3d-active': '0 2px 0 #003a8a',
                '3d-success': '0 4px 0 #15803d',
                '3d-error': '0 4px 0 #b91c1c',
                'premium': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
                'inner-glass': 'inset 0 0 0 1px rgba(255, 255, 255, 0.1)',
            }
        },
    },
    plugins: [],
}
