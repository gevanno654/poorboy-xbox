import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginForm from './components/LoginForm';
import AdminPanel from './components/AdminPanel';

// Komponen utama dengan routing
const AppContent: React.FC = () => {
  const [showAdmin, setShowAdmin] = useState(false);
  const [directToAdmin, setDirectToAdmin] = useState(false);
  const location = window.location;

  useEffect(() => {
    const adminAuth = localStorage.getItem('adminAuthenticated');
    
    // Jika admin sudah login, langsung ke admin panel
    if (adminAuth === 'true') {
      setDirectToAdmin(true);
      setShowAdmin(true);
    }
  }, []);

  // Jika mengakses URL admin, set directToAdmin
  useEffect(() => {
    if (location.pathname === '/poorboygaming') {
      setDirectToAdmin(true);
      setShowAdmin(true);
    }
  }, [location.pathname]);

  // Fungsi untuk keluar dari admin panel ke LoginForm
  const handleExitToLogin = () => {
    // Hapus semua data admin dari localStorage
    localStorage.removeItem('adminAuthenticated');
    
    // Reset semua state
    setDirectToAdmin(false);
    setShowAdmin(false);
    
    // Refresh halaman
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content */}
      <main className="mobile-view">
        {directToAdmin ? (
          <AdminPanel onExitToLogin={handleExitToLogin} />
        ) : showAdmin ? (
          <AdminPanel onExitToLogin={handleExitToLogin} />
        ) : (
          <LoginForm />
        )}
      </main>
    </div>
  );
};

// Komponen wrapper dengan Router
const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/poorboygaming" element={<AppContent />} />
        <Route path="/" element={<AppContent />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default App;