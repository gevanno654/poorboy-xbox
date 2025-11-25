import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useToken } from '../hooks/useToken';
import Swal from 'sweetalert2';
import type { AccountInfoData } from '../types';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXbox } from "@fortawesome/free-brands-svg-icons";

const LoginForm: React.FC = () => {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userToken, setUserToken] = useState('');
  const [accountInfo, setAccountInfo] = useState<AccountInfoData | null>(null);
  const [tokens, setTokens] = useState<any[]>([]);
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const { validateToken } = useToken();

  // Idle timer untuk logout otomatis setelah 1 jam
  const [idleTimer, setIdleTimer] = useState<number | null>(null);

  // Reset idle timer ketika ada aktivitas pengguna
  const resetIdleTimer = () => {
    if (idleTimer) {
      clearTimeout(idleTimer);
    }
    
    // Set timeout untuk logout setelah 1 jam idle
    const timer = window.setTimeout(() => {
      console.log('🕐 1 jam idle, logout otomatis...');
      handleLogout();
    }, 60 * 60 * 1000); // 1 jam dalam milidetik
    
    setIdleTimer(timer);
  };

  // Event listeners untuk mendeteksi aktivitas pengguna
  useEffect(() => {
    if (isAuthenticated) {
      const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
      
      const handleActivity = () => {
        resetIdleTimer();
      };

      events.forEach(event => {
        document.addEventListener(event, handleActivity);
      });

      // Inisialisasi timer pertama kali
      resetIdleTimer();

      return () => {
        events.forEach(event => {
          document.removeEventListener(event, handleActivity);
        });
        
        if (idleTimer) {
          clearTimeout(idleTimer);
        }
      };
    }
  }, [isAuthenticated]);

  // Cek autentikasi saat komponen dimount
  useEffect(() => {
    const savedAuth = localStorage.getItem('isAuthenticated');
    const savedToken = localStorage.getItem('userToken');
    
    if (savedAuth === 'true' && savedToken) {
      setIsAuthenticated(true);
      setUserToken(savedToken);
      console.log('Auto login with token:', savedToken);
    }
  }, []);

  // Real-time listener untuk tokens (untuk validasi)
  useEffect(() => {
    try {
      const q = query(collection(db, 'tokens'));
      const unsubscribe = onSnapshot(q, 
        (querySnapshot) => {
          const tokensData: any[] = [];
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.token && data.expiresAt) {
              tokensData.push({
                id: doc.id,
                token: data.token,
                createdAt: data.createdAt?.toDate() || new Date(),
                expiresAt: data.expiresAt?.toDate(),
                isActive: data.isActive !== undefined ? data.isActive : true
              });
            }
          });
          console.log('Tokens updated:', tokensData);
          setTokens(tokensData);
        },
        (error) => {
          console.error('Error listening to tokens:', error);
        }
      );

      return () => unsubscribe();
    } catch (error) {
      console.error('Error setting up token listener:', error);
    }
  }, []);

  // Real-time listener untuk account info
  useEffect(() => {
    try {
      const q = query(collection(db, 'accountInfo'));
      const unsubscribe = onSnapshot(q, 
        (querySnapshot) => {
          if (!querySnapshot.empty) {
            const doc = querySnapshot.docs[0];
            const data = doc.data();
            setAccountInfo({
              id: doc.id,
              email: data.email || '',
              password: data.password || '',
              lastUpdate: data.lastUpdate?.toDate() || new Date()
            });
          } else {
            setAccountInfo(null);
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
  }, []);

  // Helper function untuk validasi token
  const isTokenValid = (tokenToCheck: string): boolean => {
    if (!tokenToCheck) {
      console.log('No token provided');
      return false;
    }
    
    const now = new Date();
    const validToken = tokens.find(t => {
      const isMatch = t.token === tokenToCheck;
      const isActive = t.isActive;
      const isNotExpired = t.expiresAt > now;
      
      if (isMatch) {
        console.log('Token match found:', {
          token: t.token,
          isActive,
          expiresAt: t.expiresAt,
          now,
          isNotExpired,
          timeRemaining: t.expiresAt.getTime() - now.getTime()
        });
      }
      
      return isMatch && isActive && isNotExpired;
    });
    
    const isValid = !!validToken;
    console.log('Token validation final result:', { 
      token: tokenToCheck, 
      isValid,
      tokensCount: tokens.length 
    });
    
    return isValid;
  };

  // Real-time token expiration check dengan delay initial
  useEffect(() => {
    if (!isAuthenticated || !userToken || tokens.length === 0) return;

    console.log('Starting token expiration check...', { 
      userToken, 
      tokensCount: tokens.length,
      initialCheckDone 
    });

    // Beri waktu untuk tokens load pertama kali
    if (!initialCheckDone) {
      console.log('Initial check - waiting for tokens to load...');
      const timer = setTimeout(() => {
        setInitialCheckDone(true);
        console.log('Initial check completed');
      }, 2000);
      
      return () => clearTimeout(timer);
    }

    // Hanya check setelah initial check done
    const checkTokenExpiration = () => {
      const isValid = isTokenValid(userToken);
      console.log('Periodic token check:', { 
        userToken, 
        isValid, 
        time: new Date().toLocaleTimeString() 
      });
      
      if (!isValid) {
        console.log('❌ Token expired, logging out...');
        handleLogout();
      }
    };

    // Check pertama kali setelah initial load
    checkTokenExpiration();

    // Set interval untuk check setiap 30 detik
    const interval = setInterval(checkTokenExpiration, 30000);

    return () => clearInterval(interval);
  }, [userToken, tokens, initialCheckDone, isAuthenticated]);

  // Check ketika tokens berubah, tapi hanya setelah initial check
  useEffect(() => {
    if (isAuthenticated && userToken && tokens.length > 0 && initialCheckDone) {
      const isValid = isTokenValid(userToken);
      console.log('Tokens updated, checking validity:', { 
        userToken, 
        isValid,
        tokensCount: tokens.length 
      });
      
      if (!isValid) {
        console.log('❌ Token invalid after tokens update, logging out...');
        handleLogout();
      }
    }
  }, [tokens, userToken, initialCheckDone, isAuthenticated]);

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
        setIsAuthenticated(true);
        setUserToken(token.toUpperCase());
        
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('userToken', token.toUpperCase());
        
        // Reset idle timer setelah login berhasil
        resetIdleTimer();
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

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUserToken('');
    setToken('');
    setInitialCheckDone(false);
    
    if (idleTimer) {
      clearTimeout(idleTimer);
    }
    
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('loginTime');
    localStorage.removeItem('userToken');
  };

  // Function untuk copy text dengan security
  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      
      // Reset status copied setelah 2 detik
      setTimeout(() => {
        setCopiedField(null);
      }, 2000);
      
      console.log(`${field} berhasil disalin:`, text);
    } catch (err) {
      console.error('Gagal menyalin teks:', err);
      // Fallback untuk browser yang tidak support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      setCopiedField(field);
      setTimeout(() => {
        setCopiedField(null);
      }, 2000);
    }
  };

  // Function untuk menampilkan info token
  const showTokenInfo = () => {
    Swal.fire({
      title: 'Informasi Token',
      text: 'Informasi akun akan otomatis disembunyikan jika 1 jam tidak ada aktivitas.',
      icon: 'info',
      confirmButtonText: 'Mengerti',
      confirmButtonColor: '#3B82F6',
      background: '#1F2937',
      color: 'white',
      customClass: {
        popup: 'rounded-2xl',
        confirmButton: 'rounded-lg px-4 py-2'
      }
    });
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="max-w-xl mx-auto px-6 pt-6">
        {/* KONTEN UTAMA - Selalu Ditampilkan */}
        <div className="bg-white/10 backdrop-blur-md border border-white/30 rounded-3xl p-6 mb-4">
          <div className="flex flex-col items-center justify-center">
            <FontAwesomeIcon icon={faXbox} bounce size="2xl" style={{color: "#e9d5ff",}} />
            <h2 className="text-2xl font-bold text-center text-white mb-4">Xbox Gamepass Poorboy Gaming</h2>
          </div>
          <div className="text-white px-2 flex flex-col items-center justify-center">
            <p className="text-xl font-semibold text-justify mb-2 leading-snug">Cara Login:</p>
            <p className="text-justify mb-2 leading-snug">1. Sebelum lihat Video Tutorial, download Planet VPN dulu!</p>
            {/* TOMBOL LINK DOWNLOAD PLANET VPN */}
            <a 
              href="https://freevpnplanet.com/free-vpn-pc/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="bg-linear-to-tr from-blue-700 via-blue-600 to-blue-500 text-white px-3 py-2 rounded-full font-semibold drop-shadow hover:bg-blue-700 transform hover:-translate-y-0.5 transition-all duration-300 text-center"
            >
              Link Download Planet VPN
            </a>
            <p className="text-justify mt-2 mb-2 leading-snug">2. Setelah Planet VPN terinstall di PC, lihat Video Tutorial</p>
            {/* VIDEO CONTAINER LANGSUNG DITAMPILKAN */}
            <div className="w-sm border border-white/30 rounded-2xl overflow-hidden mb-2">
              {/* Video Container */}
              <div className="relative pt-[56.25%]"> {/* 16:9 Aspect Ratio */}
                <iframe
                  src="https://www.youtube.com/embed/1od3Lj8InME"
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute top-0 left-0 w-full h-full"
                ></iframe>
              </div>
            </div>

            <p className="text-justify mt-2 mb-4 leading-snug">3. Nyalakan Planet VPN (Server Bebas) hanya untuk login saja</p>
            <p className="text-justify mb-4 leading-snug">4. Selanjutnya lakukan seperti di video tutorial di atas</p>
            <p className="text-justify mb-4 leading-snug">5. Jika sudah berhasil login, matikan VPN untuk main game</p>
          </div>
          <div className="mt-4 mb-2">
            <p className="font-semibold text-white text-center leading-snug">
              Login di MICROSOFT STORE! JANGAN LOGIN DI XBOX APP!
            </p>
            <p className="font-semibold text-white text-center leading-snug">
              🙏🏻🙏🏻 Jika ada error jangan dispam login! 🙏🏻🙏🏻
            </p>
          </div>
        </div>

        {/* AREA DINAMIS - Berubah berdasarkan status autentikasi */}
        {isAuthenticated && accountInfo ? (
          // TAMPILAN SETELAH LOGIN BERHASIL - Email & Password
          <div className="bg-white/10 backdrop-blur-md border border-white/30 rounded-3xl p-6">
            <h2 className="text-2xl font-semibold text-center text-white -mt-2 mb-3">Akun Microsoft Store</h2>
            <div className="space-y-4 bg-black/20 border border-white/30 rounded-3xl px-4 py-4">
              {/* Email Field dengan Copy Button */}
              <div className="flex justify-between items-center pb-2">
                <div className="flex items-center gap-2 text-lg">
                  <label className="font-semibold text-white">Email:</label>
                  <span 
                    className="font-semibold text-white select-none"
                    style={{
                      WebkitTouchCallout: 'none',
                      WebkitUserSelect: 'none',
                      KhtmlUserSelect: 'none',
                      MozUserSelect: 'none',
                      msUserSelect: 'none',
                      userSelect: 'none'
                    }}
                  >
                    {accountInfo.email}
                  </span>
                </div>
                <button
                  onClick={() => copyToClipboard(accountInfo.email, 'email')}
                  className="flex items-center gap-2 px-3 py-2 bg-linear-to-tr from-blue-700 via-blue-600 to-blue-500 drop-shadow hover:from-blue-800 hover:via-blue-700 hover:to-blue-600 text-white rounded-lg transition-colors duration-300 text-sm font-medium"
                >
                  {copiedField === 'email' ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Done!
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Salin
                    </>
                  )}
                </button>
              </div>
              
              {/* Password Field dengan Copy Button */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-lg">
                  <label className="font-semibold text-white">Password:</label>
                  <span 
                    className="font-semibold text-white select-none"
                    style={{
                      WebkitTouchCallout: 'none',
                      WebkitUserSelect: 'none',
                      KhtmlUserSelect: 'none',
                      MozUserSelect: 'none',
                      msUserSelect: 'none',
                      userSelect: 'none'
                    }}
                  >
                    {accountInfo.password}
                  </span>
                </div>
                <button
                  onClick={() => copyToClipboard(accountInfo.password, 'password')}
                  className="flex items-center gap-2 px-3 py-2 bg-linear-to-tr from-green-700 via-green-600 to-green-500 drop-shadow hover:from-green-800 hover:via-green-700 hover:to-green-600 text-white rounded-lg transition-colors duration-300 text-sm font-medium"
                >
                  {copiedField === 'password' ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Done!
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Salin
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Token Status */}
            <div className="bg-white/10 backdrop-blur-md border border-white/30 rounded-3xl shadow-sm px-6 py-4 mt-4 relative">
              <button
                onClick={showTokenInfo}
                className="absolute top-3 right-3 p-1.5 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-all duration-300"
                title="Informasi Token"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              
              <div className="text-white text-center mb-3">
                Tekan untuk menyembunyikan informasi akun
              </div>
              
              <button
                onClick={handleLogout}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-full font-semibold transition-colors duration-300"
              >
                Sembunyikan Info Akun
              </button>
            </div>
          </div>
        ) : (
          // TAMPILAN AWAL - Form Input Token
          <div className="bg-white/10 backdrop-blur-md border border-white/30 rounded-3xl p-6">
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-white text-center text-lg font-semibold mb-3">
                  Masukkan Token Akses
                </label>
                <input
                  type="text"
                  value={token}
                  onChange={(e) => {
                    setToken(e.target.value.toUpperCase());
                    setError('');
                  }}
                  placeholder="Ketik token di sini..."
                  required
                  className="w-full px-4 py-3 border border-white/40 rounded-full placeholder:text-white/70 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all text-center font-mono tracking-wider uppercase bg-white/10 text-white"
                  disabled={isLoading}
                />
              </div>
              
              {error && (
                <div className="mb-4 p-3 border border-red-300 bg-red-500/20 rounded-lg text-red-200 text-sm text-center">
                  {error}
                </div>
              )}
              
              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-linear-to-tr from-blue-700 via-blue-600 to-blue-500 text-white text-lg py-3 rounded-full font-semibold drop-shadow hover:from-blue-800 hover:via-blue-700 hover:to-blue-600 transform hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:transform-none"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v4m0 12v4m8-10h-4M6 12H2m15.364-7.364l-2.828 2.828M7.464 17.536l-2.828 2.828m12.728 0l-2.828-2.828M7.464 6.464L4.636 3.636" />
                    </svg>
                    Memverifikasi...
                  </span>
                ) : (
                  'Buka Informasi Akun'
                )}
              </button>
            </form>

            {/* Informasi Token */}
            <div className="mt-4 p-4 bg-black/20 border border-white/20 rounded-2xl">
              <div className="text-white text-sm text-center space-y-1">
                <p>🔑 Hubungi admin jika belum memiliki token akses!</p>
                <p>📖 Budayakan membaca secara seksama dan lengkap!</p>
              </div>
            </div>
          </div>
        )}

        {/* Pesan jika tidak ada account info */}
        {isAuthenticated && !accountInfo && (
          <div className="bg-white/10 backdrop-blur-md border border-white/30 rounded-3xl p-6 text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <p className="text-white mb-2">Informasi akun belum diatur oleh admin</p>
            <p className="text-white/70 mb-4">Silakan hubungi admin untuk mengatur informasi akun</p>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-full font-semibold transition-colors duration-300"
            >
              Keluar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginForm;