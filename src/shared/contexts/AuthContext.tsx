import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Profile } from "@/shared/types";
import { request, getStoredToken, setStoredToken } from "@/shared/api/http";

interface AuthContextValue {
  user: Profile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: { email: string; password: string; full_name?: string }) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      const response = await request<{ user: Profile }>("/auth/me");
      setUser(response.user);
    } catch (error) {
      console.warn("auth check failed:", error);
      setStoredToken("");
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (getStoredToken()) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const response = await request<{ token: string; user: Profile }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      skipAuth: true,
    });
    setStoredToken(response.token);
    setUser(response.user);
  };

  const register = async (payload: { email: string; password: string; full_name?: string }) => {
    const response = await request<{ token: string; user: Profile }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
      skipAuth: true,
    });
    setStoredToken(response.token);
    setUser(response.user);
  };

  const logout = () => {
    setStoredToken("");
    setUser(null);
  };

  const refresh = async () => fetchProfile();

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth 必须在 AuthProvider 内使用");
  }
  return ctx;
}
