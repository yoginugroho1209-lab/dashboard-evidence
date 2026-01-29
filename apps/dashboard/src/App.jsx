import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import Sidebar from './components/layout/Sidebar'
import Dashboard from './pages/Dashboard'
import MapView from './pages/MapView'
import Projects from './pages/Projects'
import Reports from './pages/Reports'
import Login from './pages/Login'
import Register from './pages/Register'
import Technicians from './pages/Technicians'
import UploadEvidence from './pages/UploadEvidence'
import ProjectMaps from './pages/ProjectMaps'

import ForgotPassword from './pages/ForgotPassword'
import UpdatePassword from './pages/UpdatePassword'

function Layout({ children }) {
    const location = useLocation();
    const isAuthPage = ['/login', '/register', '/forgot-password'].includes(location.pathname);
    const isFullScreenPage = location.pathname === '/project-maps';

    return (
        <div className="flex h-screen w-full bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display overflow-hidden selection:bg-primary/30 selection:text-white">
            {!isAuthPage && !isFullScreenPage && <Sidebar />}
            {children}
        </div>
    );
}

function App() {
    return (
        <AuthProvider>
            <Router>
                <Layout>
                    <Routes>
                        {/* Public routes */}
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />
                        <Route path="/forgot-password" element={<ForgotPassword />} />
                        <Route path="/update-password" element={<UpdatePassword />} />

                        {/* Protected route - accessible by all authenticated users (teknisi & admin) */}
                        <Route path="/" element={<ProtectedRoute><UploadEvidence /></ProtectedRoute>} />
                        <Route path="/upload-evidence" element={<ProtectedRoute><UploadEvidence /></ProtectedRoute>} />

                        {/* Admin-only routes */}
                        <Route path="/dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
                        <Route path="/map" element={<AdminRoute><MapView /></AdminRoute>} />
                        <Route path="/projects" element={<AdminRoute><Projects /></AdminRoute>} />
                        <Route path="/reports" element={<AdminRoute><Reports /></AdminRoute>} />
                        <Route path="/technicians" element={<AdminRoute><Technicians /></AdminRoute>} />
                        <Route path="/project-maps" element={<AdminRoute><ProjectMaps /></AdminRoute>} />
                    </Routes>
                </Layout>
            </Router>
        </AuthProvider>
    )
}

export default App

