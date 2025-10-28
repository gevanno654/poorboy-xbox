import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import LoginForm from './components/LoginForm';
import AccountInfo from './components/AccountInfo';
import AdminPanel from './components/AdminPanel';

// Komponen utama dengan routing
const AppContent: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [directToAdmin, setDirectToAdmin] = useState(false);
  const [userToken, setUserToken] = useState<string>(''); // Simpan token user
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Cek status autentikasi dari localStorage
    const savedAuth = localStorage.getItem('isAuthenticated');
    const loginTime = localStorage.getItem('loginTime');
    const savedToken = localStorage.getItem('userToken');
    const adminAuth = localStorage.getItem('adminAuthenticated');
    
    // Jika admin sudah login, langsung ke admin panel
    if (adminAuth === 'true') {
      setDirectToAdmin(true);
      setShowAdmin(true);
    }
    
    if (savedAuth === 'true' && loginTime && savedToken) {
      const timeSinceLogin = Date.now() - parseInt(loginTime);
      // Auto logout setelah 10 menit
      if (timeSinceLogin < 10 * 60 * 1000) {
        setIsAuthenticated(true);
        setUserToken(savedToken);
        console.log('Auto login with token:', savedToken);
        
        // Set timeout untuk auto logout
        const timeout = setTimeout(() => {
          console.log('Auto logout timeout triggered');
          handleLogout();
        }, 10 * 60 * 1000 - timeSinceLogin);
        
        return () => clearTimeout(timeout);
      } else {
        console.log('Token expired, clearing storage');
        handleLogout();
      }
    }
  }, []);

  // Jika mengakses URL admin, set directToAdmin
  useEffect(() => {
    if (location.pathname === '/poorboygaming') {
      setDirectToAdmin(true);
      setShowAdmin(true);
    }
  }, [location.pathname]);

  const handleLoginSuccess = (token: string) => {
    setIsAuthenticated(true);
    setUserToken(token);
    localStorage.setItem('userToken', token);
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('loginTime', Date.now().toString());
  };

  const handleTokenExpired = () => {
    console.log('Token expired, forcing logout...');
    handleLogout();
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setDirectToAdmin(false);
    setUserToken('');
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('loginTime');
    localStorage.removeItem('userToken');
  };


  // Fungsi untuk keluar dari admin panel ke LoginForm
  const handleExitToLogin = () => {
    // Hapus semua data admin dari localStorage
    localStorage.removeItem('adminAuthenticated');
    
    // Reset semua state
    setDirectToAdmin(false);
    setShowAdmin(false);
    setIsAuthenticated(false);
    
    // Navigate ke halaman utama
    navigate('/');
  };


  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content */}
      <main className="mobile-view">
        {!isAuthenticated && !directToAdmin ? (
          <LoginForm 
            onLoginSuccess={handleLoginSuccess} 
          />
        ) : directToAdmin ? (
          <AdminPanel onExitToLogin={handleExitToLogin} />
        ) : showAdmin ? (
          <AdminPanel onExitToLogin={handleExitToLogin} />
        ) : (
          <AccountInfo 
            userToken={userToken} 
            onTokenExpired={handleTokenExpired} 
          />
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