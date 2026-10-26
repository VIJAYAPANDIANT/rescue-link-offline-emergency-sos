import React, { createContext, useState, useContext, useEffect } from 'react';
import { apiClient } from '../services/api/apiClient';

const AuthContext = createContext({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  login: async () => {},
  register: async () => {},
  logout: () => {},
  refreshProfile: async () => {},
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Authenticate existing user
  const login = async (email, password) => {
    setIsLoading(true);
    try {
      const result = await apiClient.login({ email, password });
      if (result.success) {
        setUser(result.user);
        setToken(result.token);
        return { success: true, user: result.user };
      }
      return { success: false, error: result.error };
    } finally {
      setIsLoading(false);
    }
  };

  // Register new user
  const register = async (name, email, password) => {
    setIsLoading(true);
    try {
      const result = await apiClient.register({ name, email, password });
      if (result.success) {
        setUser(result.user);
        setToken(result.token);
        return { success: true, user: result.user };
      }
      return { success: false, error: result.error };
    } finally {
      setIsLoading(false);
    }
  };

  // Log out current user
  const logout = () => {
    apiClient.logout();
    setUser(null);
    setToken(null);
  };

  // Refresh user profile from backend
  const refreshProfile = async () => {
    if (!token) return;
    const result = await apiClient.getProfile(token);
    if (result.success) {
      setUser(result.user);
    } else {
      // If token expired, clear session
      logout();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

export default AuthContext;
