import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { AccountInfoData } from '../types';
import Swal from 'sweetalert2';

interface AccountInfoProps {
  userToken: string;
  onTokenExpired: () => void;
}

const AccountInfo: React.FC<AccountInfoProps> = ({ userToken, onTokenExpired }) => {
  const [accountInfo, setAccountInfo] = useState<AccountInfoData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tokens, setTokens] = useState<any[]>([]);
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [minutesRemaining, setMinutesRemaining] = useState<number>(0);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);

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
          setIsLoading(false);
        },
        (error) => {
          console.error('Error listening to account info:', error);
          setIsLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (error) {
      console.error('Error setting up account info listener:', error);
      setIsLoading(false);
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

  // Helper function untuk mendapatkan data token
  const getTokenData = (tokenToCheck: string) => {
    return tokens.find(t => t.token === tokenToCheck);
  };

  // Function untuk copy text
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
      text: 'Anda akan otomatis logout ketika token kadaluarsa.',
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

  // Countdown timer yang berjalan setiap detik
  useEffect(() => {
    const tokenData = getTokenData(userToken);
    if (!tokenData) return;

    const updateCountdown = () => {
      const now = Date.now();
      const expiresAt = tokenData.expiresAt.getTime();
      const timeRemaining = Math.max(0, expiresAt - now);
      
      const minutes = Math.floor(timeRemaining / (1000 * 60));
      const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);
      
      setMinutesRemaining(minutes);
      setSecondsRemaining(seconds);
      
      console.log('Countdown updated:', { minutes, seconds, timeRemaining });
    };

    // Update pertama kali
    updateCountdown();

    // Set interval untuk update setiap detik
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [userToken, tokens]); // Dependency pada userToken dan tokens

  // FIXED: Real-time token expiration check dengan delay initial
  useEffect(() => {
    if (!userToken || tokens.length === 0) return;

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
      }, 2000); // Tunggu 2 detik untuk tokens load
      
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
        onTokenExpired();
      }
    };

    // Check pertama kali setelah initial load
    checkTokenExpiration();

    // Set interval untuk check setiap 30 detik (tidak terlalu sering)
    const interval = setInterval(checkTokenExpiration, 30000);

    return () => clearInterval(interval);
  }, [userToken, tokens, initialCheckDone, onTokenExpired]);

  // FIXED: Juga check ketika tokens berubah, tapi hanya setelah initial check
  useEffect(() => {
    if (userToken && tokens.length > 0 && initialCheckDone) {
      const isValid = isTokenValid(userToken);
      console.log('Tokens updated, checking validity:', { 
        userToken, 
        isValid,
        tokensCount: tokens.length 
      });
      
      if (!isValid) {
        console.log('❌ Token invalid after tokens update, logging out...');
        onTokenExpired();
      }
    }
  }, [tokens, userToken, initialCheckDone, onTokenExpired]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 mb-2">Memuat informasi akun...</p>
          <p className="text-gray-500 text-sm">Menyiapkan token validasi...</p>
        </div>
      </div>
    );
  }

  if (!accountInfo) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Informasi Akun</h2>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="text-center py-8">
            <div className="text-4xl mb-4">⚠️</div>
            <p className="text-gray-600 mb-2">Informasi akun belum diatur oleh admin</p>
            <p className="text-gray-500">Silakan hubungi admin untuk mengatur informasi akun</p>
          </div>
        </div>
        
        <div className="bg-green-50 border-l-4 border-green-500 rounded-r-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="font-semibold text-gray-800">Status Token: Aktif</span>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-green-700 text-sm text-center">✅ Token valid - Anda dapat melihat informasi akun</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="max-w-xl mx-auto px-6 pt-6">
        <h2 className="text-center text-3xl font-bold text-white mb-6">Xbox Gamepass - Poorboy Gaming</h2>
        
        <div className="bg-white/10 backdrop-blur-md border border-white/30 rounded-3xl p-6">
          <div className="text-2xl text-white text-center font-semibold mb-4">🆘🆘 Update Penting 🆘🆘</div>
          <div className="text-white px-2">
            <p className="text-justify mb-4 leading-snug">Karena akun sebelumnya masih mengalami error, silahkan login ke akun xbox terbaru ya (akun di bawah hanya untuk sementara).</p>
            <p className="text-justify mb-4 leading-snug font-bold">JANGAN LUPA! Login hanya di MICROSOFT STORE, main-nya lewat XBOX APP pakai AKUN XBOX-MU SENDIRI!</p>
            <p className="text-justify mb-4 leading-snug">Progress/save-an/achivementmu tidak akan terganggu asal tidak salah login.</p>
            <p className="text-center mb-4">🙏🏻🙏🏻 Mohon maaf atas ketidaknyamanannya 🙏🏻🙏🏻</p>
          </div>

          <div className="flex items-center justify-center gap-4 mt-6">
            <a href="https://youtu.be/1od3Lj8InME?feature=shared" className="bg-linear-to-t from-red-700 via-red-600 to-red-600 text-white px-3 py-2 rounded-full font-semibold drop-shadow hover:bg-red-600 transform hover:-translate-y-0.5 transition-all duration-300">YT Tutorial Xbox Gamepass</a>
            <a href="https://freevpnplanet.com/free-vpn-pc/" className="bg-linear-to-tr from-blue-700 via-blue-600 to-blue-500 text-white px-3 py-2 rounded-full font-semibold drop-shadow hover:bg-blue-700 transform hover:-translate-y-0.5 transition-all duration-300">Link Download Planet VPN</a>
          </div>

          <div className="mt-4 mb-2">
            <p className="font-semibold text-white text-center leading-snug">Rekomendasi login:<br></br> pakai Hotspot HP atau dan pakai Planet VPN biar tidak error!</p>
          </div>

          <div className="space-y-4 bg-black/20 border border-white/30 rounded-3xl px-4 py-4">
            {/* Email Field dengan Copy Button */}
            <div className="flex justify-between items-center pb-2">
              <div className="flex items-center gap-2 text-lg">
                <label className="font-semibold text-white">Email:</label>
                <span className="font-semibold text-white">{accountInfo.email}</span>
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
                <span className="font-semibold text-white">
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
        </div>

        {/* Token Status & Countdown */}
        <div className="bg-white/10 backdrop-blur-md border border-white/30 rounded-3xl shadow-sm px-6 py-4 mt-4 relative">
          {/* Info Button di pojok kanan atas */}
          <button
            onClick={showTokenInfo}
            className="absolute top-3 right-3 p-1.5 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-all duration-300"
            title="Informasi Token"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          
          <div className="text-white text-center">Token kadaluarsa dalam:</div>
          <div className="text-2xl font-bold font-mono text-red-400 text-center">
            {minutesRemaining.toString().padStart(2, '0')} menit, {secondsRemaining.toString().padStart(2, '0')} detik
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountInfo;