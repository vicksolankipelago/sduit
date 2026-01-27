import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { logger } from '../utils/logger';

const authLogger = logger.namespace('Auth');

type UserRole = 'admin' | 'member' | 'test';

interface User {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  role: UserRole;
  termsAcceptedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterData extends LoginCredentials {
  firstName?: string;
  lastName?: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isMember: boolean;
  hasAcceptedTerms: boolean;
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  registerAdmin: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  acceptTerms: () => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchUser(): Promise<User | null> {
  try {
    const response = await fetch("/api/auth/user", {
      credentials: "include",
    });

    if (response.status === 401) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`${response.status}: ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    authLogger.error("Failed to fetch user:", error);
    return null;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    setLoading(true);
    try {
      const fetchedUser = await fetchUser();
      setUser(fetchedUser);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const data = await response.json();
        return { success: false, error: data.message || "Login failed" };
      }

      const userData = await response.json();
      setUser(userData);
      return { success: true };
    } catch (error) {
      authLogger.error("Login error:", error);
      return { success: false, error: "An error occurred during login" };
    }
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const result = await response.json();
        return { success: false, error: result.message || "Registration failed" };
      }

      const userData = await response.json();
      setUser(userData);
      return { success: true };
    } catch (error) {
      authLogger.error("Registration error:", error);
      return { success: false, error: "An error occurred during registration" };
    }
  }, []);

  const registerAdmin = useCallback(async (data: RegisterData) => {
    try {
      const response = await fetch("/api/admin/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const result = await response.json();
        return { success: false, error: result.message || "Registration failed" };
      }

      const userData = await response.json();
      setUser(userData);
      return { success: true };
    } catch (error) {
      console.error("Admin registration error:", error);
      return { success: false, error: "An error occurred during registration" };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      });
      setUser(null);
    } catch (error) {
      authLogger.error("Logout error:", error);
    }
  }, []);

  const acceptTerms = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/accept-terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!response.ok) {
        const result = await response.json();
        return { success: false, error: result.message || "Failed to accept terms" };
      }

      const userData = await response.json();
      setUser(userData);
      return { success: true };
    } catch (error) {
      authLogger.error("Accept terms error:", error);
      return { success: false, error: "An error occurred while accepting terms" };
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isAuthenticated: !!user,
      isAdmin: user?.role === 'admin',
      isMember: user?.role === 'member',
      hasAcceptedTerms: !!user?.termsAcceptedAt,
      login,
      register,
      registerAdmin,
      logout,
      refreshUser,
      acceptTerms,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
