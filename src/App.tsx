import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MasterDataPage from './pages/MasterDataPage';
import SchemaBuilderPage from './pages/SchemaBuilderPage';
import ManagerTicketsPage from './pages/ManagerTicketsPage';
import TechnicianTicketsPage from './pages/TechnicianTicketsPage';
import MapPage from './pages/MapPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuth();
    if (isLoading) return <div className="min-h-screen flex items-center justify-center text-primary-600">جاري التحميل...</div>;
    if (!user) return <Navigate to="/login" replace />;
    return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuth();
    if (isLoading) return null;
    if (user) return <Navigate to="/" replace />;
    return <>{children}</>;
}

function App() {
    return (
        <Routes>
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/tickets" element={<PrivateRoute><MasterDataPage tableName="tickets" /></PrivateRoute>} />
            <Route path="/my-tickets" element={<PrivateRoute><ManagerTicketsPage /></PrivateRoute>} />
            <Route path="/tech-tickets" element={<PrivateRoute><TechnicianTicketsPage /></PrivateRoute>} />
            <Route path="/map" element={<PrivateRoute><MapPage /></PrivateRoute>} />
            <Route path="/inventory" element={<PrivateRoute><MasterDataPage tableName="inventory" /></PrivateRoute>} />
            <Route path="/branches" element={<PrivateRoute><MasterDataPage tableName="branches" /></PrivateRoute>} />
            <Route path="/users" element={<PrivateRoute><MasterDataPage tableName="profiles" /></PrivateRoute>} />
            <Route path="/settings" element={<PrivateRoute><SchemaBuilderPage /></PrivateRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

export default App;
