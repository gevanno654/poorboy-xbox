import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useToken } from '../hooks/useToken';
import { RotateCcwKey } from 'lucide-react';

interface LoginFormProps {
  onLoginSuccess: (token: string) => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess }) => {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isLoadingLastUpdate, setIsLoadingLastUpdate] = useState(true);
  const { validateToken } = useToken();

  // Real-time listener untuk last update
  useEffect(() => {
    try {
      const q = query(collection(db, 'accountInfo'));
      const unsubscribe = onSnapshot(q, 
        (querySnapshot) => {
          if (!querySnapshot.empty) {
            const doc = querySnapshot.docs[0];
            const data = doc.data();
            if (data.lastUpdate) {
              setLastUpdate(data.lastUpdate.toDate());
            }
          }
          setIsLoadingLastUpdate(false);
        },
        (error) => {
          console.error('Error listening to last update:', error);
          setIsLoadingLastUpdate(false);
        }
      );

      return () => unsubscribe();
    } catch (error) {
      console.error('Error setting up last update listener:', error);
      setIsLoadingLastUpdate(false);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validasi input
    if (!token.trim()) {
      setError('Token tidak boleh kosong');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      console.log('Validating token:', token);
      const isValid = await validateToken(token.toUpperCase());
      console.log('Validation result:', isValid);
      
      if (isValid) {
        onLoginSuccess(token.toUpperCase());
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('loginTime', Date.now().toString());
        localStorage.setItem('userToken', token.toUpperCase());
      } else {
        setError('Token tidak valid atau sudah kadaluarsa');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Terjadi kesalahan saat validasi token');
    } finally {
      setIsLoading(false);
    }
  };

  const formatLastUpdate = (date: Date) => {
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 1) {
      return 'Baru saja';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes} menit yang lalu`;
    } else if (diffInHours < 24) {
      return `${diffInHours} jam yang lalu`;
    } else if (diffInDays === 1) {
      return 'Kemarin';
    } else {
      return `${diffInDays} hari yang lalu`;
    }
  };

  const getLastUpdateColor = (date: Date) => {
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) return 'border-l-green-500 bg-green-50';
    if (diffInHours < 24) return 'border-l-yellow-500 bg-yellow-50';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-slate-900 via-purple-900 to-slate-900 px-4">
      <div className="bg-white/10 backdrop-blur-md border border-white/30 rounded-3xl p-7 w-full max-w-md">
        <div className="flex flex-col items-center justify-center">
          <RotateCcwKey className="w-12 h-12 text-purple-400" />
          <h2 className="text-2xl font-bold text-center text-white mb-6">Xbox Gamepass Poorboy Gaming</h2>
        </div>

        <div className="flex flex-col items-center justify-center space-y-2 text-white border border-white/30 rounded-2xl p-4 bg-black/15 mb-3">
          <span className="font-semibold text-lg underline underline-offset-3">Pemberitahuan!</span>
          <div className="text-sm space-y-2">
            <p className="flex items-center gap-2">🔑 Hubungi admin untuk mendapatkan token baru</p>
            <p className="flex items-center gap-2">⏰ Token akan kadaluarsa dalam 10 menit setelah dibuat</p>
            <p className="flex items-center gap-2">⚠️ Anda akan otomatis logout ketika token kadaluarsa</p>
          </div>
        </div>

        {/* Last Update Information */}
        {!isLoadingLastUpdate && lastUpdate && (
          <div className={`flex flex-col items-center justify-center border border-white/30 rounded-2xl px-4 py-3 mb-6 bg-black/15 ${getLastUpdateColor(lastUpdate)}`}>
            <div className="mb-3 text-white font-semibold text-lg underline underline-offset-3">
              Informasi Terakhir Update
            </div>
            <p className="text-lg font-semibold text-center text-white mb-1">
              {formatLastUpdate(lastUpdate)}
            </p>
            <p className="text-white text-sm text-center">
              {lastUpdate.toLocaleString('id-ID', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit' 
              })}
            </p>
          </div>
        )}

        {!isLoadingLastUpdate && !lastUpdate && (
          <div className="border border-white/30 rounded-2xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span>⚠️</span>
              <strong className="text-gray-700">Informasi Update</strong>
            </div>
            <p className="text-lg font-semibold text-center text-yellow-700">
              Belum ada informasi akun yang diatur
            </p>
          </div>
        )}

        {isLoadingLastUpdate && (
          <div className="border border-l bg-gray-100 rounded-r-lg p-4 mb-6">
            <div className="flex items-center gap-2">
              <span>⏳</span>
              <strong className="text-gray-700">Memuat informasi...</strong>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4 text-lg text-white">
            <input
              type="text"
              value={token}
              onChange={(e) => {
                setToken(e.target.value.toUpperCase());
                setError('');
              }}
              placeholder="Masukkan token akses"
              required
              className="w-full px-4 py-3 border border-white/40 rounded-full placeholder:text-white/70 focus:ring-1 focus:ring-green-500 focus:border-transparent outline-none transition-all text-center font-mono tracking-wider uppercase"
              disabled={isLoading}
            />
          </div>
          
          {error && (
            <div className="mb-4 p-3 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
          
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-linear-to-tr from-blue-700 via-blue-600 to-blue-500 text-white text-lg py-2 rounded-full font-semibold drop-shadow hover:bg-blue-700 transform hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:transform-none"
          >
            {isLoading ? 'Memverifikasi...' : 'Buka Informasi'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginForm;