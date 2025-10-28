import { useState, useEffect } from 'react';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  onSnapshot,
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Token } from '../types';

export const useToken = () => {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Real-time listener untuk tokens
  useEffect(() => {
    try {
      const q = query(collection(db, 'tokens'));
      const unsubscribe = onSnapshot(q, 
        (querySnapshot) => {
          const tokensData: Token[] = [];
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            // Pastikan semua field ada
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

  const createToken = async (): Promise<string> => {
    setIsLoading(true);
    try {
      const newToken = Math.random().toString(36).substring(2, 10).toUpperCase();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      const docRef = await addDoc(collection(db, 'tokens'), {
        token: newToken,
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAt),
        isActive: true
      });

      console.log('Token created with ID:', docRef.id);
      return newToken;
    } catch (error) {
      console.error('Error creating token:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const validateToken = async (inputToken: string): Promise<boolean> => {
    try {
      const q = query(
        collection(db, 'tokens'),
        where('token', '==', inputToken),
        where('isActive', '==', true)
      );

      const querySnapshot = await getDocs(q);
      const now = new Date();

      for (const doc of querySnapshot.docs) {
        const data = doc.data();
        const expiresAt = data.expiresAt?.toDate();
        
        if (expiresAt && expiresAt > now) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Error validating token:', error);
      return false;
    }
  };

  // Fungsi untuk cek apakah token masih valid (real-time)
  const isTokenValid = (inputToken: string): boolean => {
    if (!inputToken) return false;
    
    const now = new Date();
    const validToken = tokens.find(token => {
      // Debug logging
      if (token.token === inputToken) {
        console.log('Token found:', {
          token: token.token,
          expiresAt: token.expiresAt,
          isActive: token.isActive,
          isExpired: token.expiresAt <= now,
          timeRemaining: token.expiresAt.getTime() - now.getTime()
        });
      }
      
      return (
        token.token === inputToken && 
        token.isActive && 
        token.expiresAt > now
      );
    });
    
    const isValid = !!validToken;
    console.log('Token validation result:', { inputToken, isValid });
    
    return isValid;
  };

  return {
    tokens,
    createToken,
    validateToken,
    isTokenValid,
    isLoading
  };
};