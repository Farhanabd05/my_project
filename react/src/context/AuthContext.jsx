// react/src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fungsi untuk meminta token jembatan dari PHP
  const syncTokenFromPhp = async () => {
    try {
      const res = await fetch('/api/get_auth_token.php');
      const data = await res.json();

      if (data.success && data.token) {
        setToken(data.token);
        setUser(data.user); // { id: 1, role: 'BUYER' }
      } else {
        setToken(null);
        setUser(null);
      }
    } catch (error) {
      console.error("Gagal sinkronisasi auth dengan PHP:", error);
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Panggil saat pertama kali load
  useEffect(() => {
    syncTokenFromPhp();
  }, []);

  // Fungsi Helper: Redirect ke Login PHP jika belum login
  const redirectToLogin = () => {
    window.location.href = 'http://localhost:8082/login.php';
  };

  return (
    <AuthContext.Provider value={{ token, user, loading, redirectToLogin, syncTokenFromPhp }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom Hook biar gampang dipanggil: const { token } = useAuth();
export const useAuth = () => {
  return useContext(AuthContext);
};