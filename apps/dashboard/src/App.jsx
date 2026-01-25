import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
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

                        {/* Protected routes */}
                        <Route path="/" element={<ProtectedRoute><UploadEvidence /></ProtectedRoute>} />
                        <Route path="/map" element={<ProtectedRoute><MapView /></ProtectedRoute>} />
                        <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
                        <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
                        <Route path="/technicians" element={<ProtectedRoute><Technicians /></ProtectedRoute>} />
                        <Route path="/upload-evidence" element={<ProtectedRoute><UploadEvidence /></ProtectedRoute>} />
                        <Route path="/project-maps" element={<ProtectedRoute><ProjectMaps /></ProtectedRoute>} />
                    </Routes>
                </Layout>
            </Router>
        </AuthProvider>
    )
}

export default App
