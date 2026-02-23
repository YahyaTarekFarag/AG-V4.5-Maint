import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.ico', 'icons/*.png'],
            manifest: {
                name: 'نظام صيانة ب. لبن',
                short_name: 'صيانة لبن',
                description: 'النظام المتكامل لإدارة صيانة فروع ب. لبن',
                theme_color: '#0d9488',
                background_color: '#ffffff',
                display: 'standalone',
                orientation: 'portrait',
                dir: 'rtl',
                lang: 'ar',
                icons: [
                    {
                        src: 'icons/icon-192x192.png',
                        sizes: '192x192',
                        type: 'image/png'
                    },
                    {
                        src: 'icons/icon-512x512.png',
                        sizes: '512x512',
                        type: 'image/png'
                    },
                    {
                        src: 'icons/icon-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any maskable'
                    }
                ]
            }
        })
    ],
    optimizeDeps: {
        exclude: ['lucide-react'],
    },
});
