import React, { createContext, useContext, useState, useEffect } from 'react';
import adminApi from '../api/adminApi';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [user, setUser] = useState(() => adminApi.getSavedUser());
  const [token, setToken] = useState(() => adminApi.getToken());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      if (token) {
        try {
          const res = await adminApi.getProfile();
          if (res.user && res.user.role === 'admin') {
            setUser(res.user);
            adminApi.setSession(token, res.user);
          } else {
            // Not an admin
            adminApi.clearSession();
            setUser(null);
            setToken(null);
          }
        } catch (err) {
          adminApi.clearSession();
          setUser(null);
          setToken(null);
        }
      }
      setLoading(false);
    }

    checkAuth();

    const handleExpired = () => {
      setUser(null);
      setToken(null);
    };

    window.addEventListener('admin_auth_expired', handleExpired);
    return () => window.removeEventListener('admin_auth_expired', handleExpired);
  }, [token]);

  const login = async (email, password) => {
    const res = await adminApi.login(email, password);
    setToken(res.token);
    setUser(res.user);
    return res.user;
  };

  const logout = () => {
    adminApi.clearSession();
    setUser(null);
    setToken(null);
  };

  return (
    <AdminAuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}
