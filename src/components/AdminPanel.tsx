import React, { useState, useEffect } from 'react';
import { useToken } from '../hooks/useToken';
import { collection, onSnapshot, query, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { AccountInfoData } from '../types';
import Swal from 'sweetalert2';
import { Copy } from 'lucide-react';

interface AdminPanelProps {
  onExitToLogin: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onExitToLogin }) => {
  const { createToken, tokens, isLoading } = useToken();
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminCredentials, setAdminCredentials] = useState({ username: '', password: '' });
  const [adminError, setAdminError] = useState('');
  const [newToken, setNewToken] = useState<string>('');
  const [accountInfo, setAccountInfo] = useState<AccountInfoData | null>(null);
  const [editForm, setEditForm] = useState({ email: '', password: '' });
  const [currentTime, setCurrentTime] = useState(new Date());

  // Admin credentials
  const ADMIN_USERNAME = 'poorboygaming';
  const ADMIN_PASSWORD = 'Lavignator10!';

  // Fungsi untuk copy token
  const handleCopyToken = async () => {
    try {
      await navigator.clipboard.writeText(newToken);
      Swal.fire({
        icon: 'success',
        title: 'Berhasil!',
        text: 'Token berhasil disalin ke clipboard!',
        timer: 2000,
        showConfirmButton: false,
        background: '#1e293b',
        color: 'white',
        iconColor: '#10b981'
      });
    } catch (error) {
      console.error('Gagal menyalin token:', error);
      // Fallback untuk browser yang tidak support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = newToken;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      Swal.fire({
        icon: 'success',
        title: 'Berhasil!',
        text: 'Token berhasil disalin!',
        timer: 2000,
        showConfirmButton: false,
        background: '#1e293b',
        color: 'white',
        iconColor: '#10b981'
      });
    }
  };

  // Timer untuk update currentTime setiap detik
  useEffect(() => {
    if (!isAdminAuthenticated) return;

    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, [isAdminAuthenticated]);

  // Real-time listener untuk account info
  useEffect(() => {
    if (!isAdminAuthenticated) return;

    try {
      const q = query(collection(db, 'accountInfo'));
      const unsubscribe = onSnapshot(q, 
        (querySnapshot) => {
          if (!querySnapshot.empty) {
            const doc = querySnapshot.docs[0];
            const data = doc.data();
            const accountData = {
              id: doc.id,
              email: data.email || '',
              password: data.password || '',
              lastUpdate: data.lastUpdate?.toDate() || new Date()
            };
            setAccountInfo(accountData);
            setEditForm({
              email: accountData.email,
              password: accountData.password
            });
          } else {
            setAccountInfo(null);
            setEditForm({
              email: '',
              password: ''
            });
          }
        },
        (error) => {
          console.error('Error listening to account info:', error);
        }
      );

      return () => unsubscribe();
    } catch (error) {
      console.error('Error setting up account info listener:', error);
    }
  }, [isAdminAuthenticated]);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');

    if (adminCredentials.username === ADMIN_USERNAME && 
        adminCredentials.password === ADMIN_PASSWORD) {
      setIsAdminAuthenticated(true);
      localStorage.setItem('adminAuthenticated', 'true');
    } else {
      setAdminError('Username atau password admin salah');
    }
  };

  const handleAdminLogout = () => {
    setIsAdminAuthenticated(false);
    setAdminCredentials({ username: '', password: '' });
    localStorage.removeItem('adminAuthenticated');
    window.history.pushState({}, '', '/');
  };

  const handleCreateToken = async () => {
    try {
      const token = await createToken();
      setNewToken(token);
      setTimeout(() => setNewToken(''), 20000);
    } catch (error) {
      console.error('Failed to create token');
      Swal.fire({
        icon: 'error',
        title: 'Gagal!',
        text: 'Gagal membuat token baru',
        timer: 3000,
        background: '#1e293b',
        color: 'white',
        iconColor: '#ef4444'
      });
    }
  };

  const handleSaveAccountInfo = async () => {
    try {
      if (accountInfo) {
        const docRef = doc(db, 'accountInfo', accountInfo.id);
        await updateDoc(docRef, {
          email: editForm.email,
          password: editForm.password,
          lastUpdate: new Date()
        });
      } else {
        await addDoc(collection(db, 'accountInfo'), {
          email: editForm.email,
          password: editForm.password,
          lastUpdate: new Date()
        });
      }
      
      Swal.fire({
        icon: 'success',
        title: 'Berhasil!',
        text: 'Data akun berhasil disimpan!',
        timer: 2000,
        showConfirmButton: false,
        background: '#1e293b',
        color: 'white',
        iconColor: '#10b981'
      });
    } catch (error) {
      console.error('Error saving account info:', error);
      Swal.fire({
        icon: 'error',
        title: 'Gagal!',
        text: 'Gagal menyimpan data akun',
        timer: 3000,
        background: '#1e293b',
        color: 'white',
        iconColor: '#ef4444'
      });
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('id-ID');
  };

  const isTokenExpired = (expiresAt: Date) => {
    return currentTime > expiresAt;
  };

  const getTimeRemaining = (expiresAt: Date) => {
    const timeRemaining = expiresAt.getTime() - currentTime.getTime();
    
    if (timeRemaining <= 0) return { minutes: 0, seconds: 0 };
    
    const minutes = Math.floor(timeRemaining / (1000 * 60));
    const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);
    
    return { minutes, seconds };
  };

  useEffect(() => {
    const savedAuth = localStorage.getItem('adminAuthenticated');
    if (savedAuth === 'true') {
      setIsAdminAuthenticated(true);
    }
  }, []);

  if (!isAdminAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-slate-900 via-purple-900 to-slate-900 px-4">
        <div className="bg-white/10 backdrop-blur-md border border-white/30 rounded-3xl p-8 w-full max-w-md">
          <h2 className="text-2xl font-bold text-center text-white mb-6">Login Admin</h2>
          <form onSubmit={handleAdminLogin}>
            <div className="mb-4 text-lg text-white">
              <label className="block font-semibold mb-1 ml-3">Username:</label>
              <input
                type="text"
                value={adminCredentials.username}
                onChange={(e) => setAdminCredentials({
                  ...adminCredentials,
                  username: e.target.value
                })}
                placeholder="Masukkan username admin"
                required
                className="w-full px-4 py-2 border border-white/40 rounded-full placeholder:text-white/70 focus:ring-1 focus:ring-green-500 focus:border-transparent outline-none transition-all"
              />
            </div>
            
            <div className="mb-6 text-lg text-white">
              <label className="block font-semibold mb-1 ml-3">Password:</label>
              <input
                type="password"
                value={adminCredentials.password}
                onChange={(e) => setAdminCredentials({
                  ...adminCredentials,
                  password: e.target.value
                })}
                placeholder="Masukkan password admin"
                required
                className="w-full px-4 py-2 border border-white/40 rounded-full placeholder:text-white/70 focus:ring-1 focus:ring-green-500 focus:border-transparent outline-none transition-all"
              />
            </div>
            
            {adminError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {adminError}
              </div>
            )}
            
            <button 
              type="submit" 
              className="w-full bg-linear-to-tr from-blue-700 via-blue-600 to-blue-500 text-white text-lg py-3 rounded-full font-semibold drop-shadow hover:bg-blue-700 transform hover:-translate-y-0.5 transition-all duration-300 mb-4"
            >
              Login
            </button>

            <div className="text-sm text-white text-center py-3">
              — Ingin memasukkan akses token? —
            </div>

            {/* Button Keluar Admin - Kembali ke LoginForm */}
            <button 
              type="button"
              onClick={onExitToLogin}
              className="w-full bg-linear-to-t from-red-700 via-red-600 to-red-600 text-white py-2 rounded-full font-semibold drop-shadow hover:bg-red-600 transform hover:-translate-y-0.5 transition-all duration-300"
            >
              Kembali ke Mode Pelanggan
            </button>
          </form>
        </div>
      </div>
    );
  }

  const activeTokens = tokens.filter(token => !isTokenExpired(token.expiresAt));

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col items-center pb-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between w-full gap-4 mb-8 py-4 px-8 border-b border-white/40 drop-shadow sticky top-0 bg-white/10 backdrop-blur-md z-100">
        <h2 className="text-2xl font-bold text-white">Admin Panel</h2>
        <div className="flex flex-col sm:flex-row gap-6">
          <div className="flex items-center justify-center">
            <span className="bg-black/20 text-white px-4 py-2 rounded-full font-semibold border border-white/40">
              Token Aktif: <strong>{activeTokens.length}</strong>
            </span>
          </div>
          <button 
            onClick={handleAdminLogout} 
            className="px-6 py-2 bg-linear-to-tr from-green-700 via-green-600 to-green-500 drop-shadow hover:from-green-800 hover:via-green-700 hover:to-green-600 text-white rounded-full transition-colors duration-300 font-bold"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="flex justify-center gap-20">
        {/* Token Management Section */}
        <div className="bg-white/10 backdrop-blur-md border border-white/30 rounded-3xl p-6 mb-8">
          <h3 className="text-xl font-semibold text-white mb-2 ml-4">Manajemen Token</h3>
          
          <div className="text-center bg-black/20 border border-white/40 rounded-xl p-6 mb-8">
            <button 
              onClick={handleCreateToken} 
              disabled={isLoading}
              className="bg-linear-to-tr from-green-700 via-green-600 to-green-500 text-white px-6 py-3 rounded-full font-semibold hover:from-green-800 hover:via-green-700 hover:to-green-600 transition-colors duration-300 disabled:opacity-50 disabled:transform-none"
            >
              {isLoading ? 'Membuat Token...' : 'Buat Token Baru'}
            </button>
            
            {newToken && (
              <div className="mt-4 p-4 bg-white/10 border border-white/40 rounded-xl">
                <p className="text-white mb-2">✅ Token Berhasil Dibuat:</p>
                <div className="flex items-center justify-center gap-2">
                  <strong className="text-2xl text-white font-mono tracking-wider block my-2">{newToken}</strong>
                  <button
                    onClick={handleCopyToken}
                    className="bg-linear-to-tr from-blue-600 to-blue-500 text-white p-2 rounded-lg hover:from-blue-700 hover:to-blue-600 transition-colors duration-300 flex items-center gap-2"
                  >
                    <Copy size={16} />
                  </button>
                </div>
                <p className="text-white">Token akan kadaluarsa dalam 10 menit</p>
              </div>
            )}
          </div>

          <div className="space-y-8">
            {/* Active Tokens */}
            <div>
              <h4 className="text-lg font-semibold text-white mb-2 flex items-center ml-4">
                🟢 Token Aktif ({activeTokens.length})
              </h4>
              {activeTokens.length === 0 ? (
                <div className="text-center py-8 bg-black/20 rounded-lg">
                  <p className="text-gray-500 italic">Tidak ada token aktif</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-white/30">
                  <table className="w-full">
                    <thead className="bg-black/20 border-b border-white/30">
                      <tr>
                        <th className="px-6 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider">Token</th>
                        <th className="px-6 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider">Dibuat</th>
                        <th className="px-6 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider">Kadaluarsa</th>
                        <th className="px-6 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider">Sisa Waktu</th>
                        <th className="px-6 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/30">
                      {activeTokens.map((token) => {
                        const timeRemaining = getTimeRemaining(token.expiresAt);
                        return (
                          <tr key={token.id} className="bg-black/20 hover:bg-black/10 transition-colors">
                            <td className="px-6 py-4 font-mono font-bold text-white text-center">{token.token}</td>
                            <td className="px-6 py-4 text-white text-center">{formatTime(token.createdAt)}</td>
                            <td className="px-6 py-4 text-white text-center">{formatTime(token.expiresAt)}</td>
                            <td className="px-6 py-4 font-mono font-bold text-red-400 text-center">
                              {timeRemaining.minutes.toString().padStart(2, '0')}:
                              {timeRemaining.seconds.toString().padStart(2, '0')}
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-700/50 text-white border border-white/40">
                                ✅ Aktif
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Account Info Management Section */}
        <div className="h-full bg-white/10 rounded-3xl p-6 sticky top-26 border border-white/30">
          <h3 className="text-xl text-center font-semibold text-white mb-4">Manajemen Informasi Akun</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-white font-semibold mb-1 ml-3">Email:</label>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="Masukkan email"
                className="w-full px-4 py-3 border border-white/40 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              />
            </div>
            
            <div>
              <label className="block text-white font-semibold mb-1 ml-3">Password:</label>
              <input
                type="text"
                value={editForm.password}
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                placeholder="Masukkan password"
                className="w-full px-4 py-3 border border-white/40 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              />
            </div>
            
            <button
              onClick={handleSaveAccountInfo}
              className="w-full bg-linear-to-tr from-blue-700 via-blue-600 to-blue-500 text-white py-2 rounded-full font-semibold drop-shadow hover:from-blue-800 hover:via-blue-700 hover:to-blue-600 transition-colors duration-300"
            >
              Simpan Perubahan
            </button>
          </div>
          
          {accountInfo && (
            <div className="mt-6 p-4 bg-black/20 border border-white/40 rounded-xl">
              <p className="text-white text-center text-sm">Terakhir Update Data Akun:</p>
              <p className="text-white text-center font-semibold mt-1">
                {accountInfo.lastUpdate.toLocaleString('id-ID')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;