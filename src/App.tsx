import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Skeleton from './components/ui/Skeleton';
import { Loader2 } from 'lucide-react';

// Lazy load pages for better performance
const Login = React.lazy(() => import('./pages/Login'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const MasterDataPage = React.lazy(() => import('./pages/MasterDataPage'));
const SchemaBuilderPage = React.lazy(() => import('./pages/SchemaBuilderPage'));
const ManagerTicketsPage = React.lazy(() => import('./pages/ManagerTicketsPage'));
const TechnicianTicketsPage = React.lazy(() => import('./pages/TechnicianTicketsPage'));
const MapPage = React.lazy(() => import('./pages/MapPage'));
const AdminSettingsPage = React.lazy(() => import('./pages/AdminSettingsPage'));
const MaintenanceDashboardPage = React.lazy(() => import('./pages/MaintenanceDashboardPage'));
const TechnicianSalaryPage = React.lazy(() => import('./pages/TechnicianSalaryPage'));
const AttendanceDashboardPage = React.lazy(() => import('./pages/AttendanceDashboardPage'));
const ReportsPage = React.lazy(() => import('./pages/ReportsPage'));

const PageLoader = () => (
    <div className="p-8 space-y-4">
        <Skeleton className="h-12 w-1/3 rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
    </div>
);

function PrivateRoute({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuth();
    if (isLoading) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-surface-950 text-brand-blaban gap-4">
            <Loader2 className="w-10 h-10 animate-spin" />
            <p className="text-sm font-bold animate-pulse">جاري التحقق من الهوية الرقمية...</p>
        </div>
    );
    if (!user) return <Navigate to="/login" replace />;
    return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuth();
    if (isLoading) return null;
    if (user) return <Navigate to="/" replace />;
    return <>{children}</>;
}

import ErrorBoundary from './components/ui/ErrorBoundary';

function App() {
    return (
        <ErrorBoundary>
            <React.Suspense fallback={<PageLoader />}>
                <Routes>
                    <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
                    <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                    <Route path="/manage/:tableName" element={<PrivateRoute><MasterDataPage /></PrivateRoute>} />
                    <Route path="/my-tickets" element={<PrivateRoute><ManagerTicketsPage /></PrivateRoute>} />
                    <Route path="/tech-tickets" element={<PrivateRoute><TechnicianTicketsPage /></PrivateRoute>} />
                    <Route path="/maint-dashboard" element={<PrivateRoute><MaintenanceDashboardPage /></PrivateRoute>} />
                    <Route path="/map" element={<PrivateRoute><MapPage /></PrivateRoute>} />
                    <Route path="/settings" element={<PrivateRoute><SchemaBuilderPage /></PrivateRoute>} />
                    <Route path="/admin/settings" element={<PrivateRoute><AdminSettingsPage /></PrivateRoute>} />
                    <Route path="/my-salary" element={<PrivateRoute><TechnicianSalaryPage /></PrivateRoute>} />
                    <Route path="/attendance-live" element={<PrivateRoute><AttendanceDashboardPage /></PrivateRoute>} />
                    <Route path="/reports" element={<PrivateRoute><ReportsPage /></PrivateRoute>} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </React.Suspense>
        </ErrorBoundary>
    );
}

export default App;
