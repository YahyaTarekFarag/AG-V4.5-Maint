import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import App from './App'
import './index.css'

import { ToastProvider } from '@/contexts/ToastContext'

// Clear any stuck Service Workers that might be intercepting Supabase /rest/v1 requests
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
            registration.unregister();
            console.log("Deleted old Service Worker.");
        }
    });
}
ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <AuthProvider>
            <ToastProvider>
                <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                    <App />
                </BrowserRouter>
            </ToastProvider>
        </AuthProvider>
    </React.StrictMode>,
)
