import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export function getRoleDashboardPath(role) {
  const norm = (role || '').toUpperCase().replace(/ /g, '_');
  switch (norm) {
    case 'ADMIN':
      return '/admin/dashboard';
    case 'PROJECT_MANAGER':
      return '/manager/dashboard';
    case 'DEVELOPER':
      return '/developer/dashboard';
    case 'TESTER':
      return '/tester/dashboard';
    default:
      return '/developer/dashboard';
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('bugflow_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      if (token) {
        try {
          const res = await api.getMe();
          setUser(res.user);
        } catch (err) {
          console.warn('Session expired or invalid token:', err);
          logout();
        }
      }
      setLoading(false);
    }
    loadUser();
  }, [token]);

  const login = async (username, password) => {
    const res = await api.login(username, password);
    localStorage.setItem('bugflow_token', res.access_token);
    setToken(res.access_token);
    setUser(res.user);
    return res.user;
  };

  const register = async (userData) => {
    const res = await api.register(userData);
    localStorage.setItem('bugflow_token', res.access_token);
    setToken(res.access_token);
    setUser(res.user);
    return res.user;
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // Ignore network errors on logout
    }
    localStorage.removeItem('bugflow_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, getRoleDashboardPath }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
