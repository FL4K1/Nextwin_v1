"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { authAPI, UserProfile, getToken, clearToken, setTokens } from "./api";

interface Profile {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: "patient" | "doctor" | "admin";
  did_identifier?: string;
  wallet_address?: string;
  avatar_url?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  profile: Profile | null;
  loading: boolean;
  login: (credentials: { email?: string; username?: string; password: string }) => Promise<void>;
  register: (data: { email: string; password: string; username: string; first_name?: string; last_name?: string; role?: string }) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const publicPaths = ["/login", "/register"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const restoreSession = useCallback(async () => {
    const token = getToken();

    // Check if no-login demo mode is explicitly enabled for local development only
    const isExplicitDemoNoLogin =
      process.env.NODE_ENV !== "production" &&
      process.env.NEXT_PUBLIC_DEMO_NO_LOGIN === "true";

    if (!token) {
      if (isExplicitDemoNoLogin) {
        const syntheticUser: UserProfile = {
          id: "00000000-0000-0000-0000-000000000001",
          username: "demo_patient",
          email: "demo@nexttwin.local",
          first_name: "Demo",
          last_name: "Patient",
          role: "patient",
        };
        setUser(syntheticUser);
        setProfile(syntheticUser as Profile);
        setLoading(false);
        return;
      }

      setUser(null);
      setProfile(null);
      setLoading(false);
      if (!publicPaths.includes(pathname)) {
        router.push("/login");
      }
      return;
    }

    try {
      const userProfile = await authAPI.getProfile();
      setUser(userProfile);
      setProfile(userProfile as Profile);
    } catch (err: unknown) {
      console.warn("Stored JWT session invalid or expired, clearing session:", err);
      clearToken();
      setUser(null);
      setProfile(null);
      if (!publicPaths.includes(pathname)) {
        router.push("/login");
      }
    } finally {
      setLoading(false);
    }
  }, [pathname, router]);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  const login = async ({ email, username, password }: { email?: string; username?: string; password: string }) => {
    setLoading(true);
    try {
      const creds: { username?: string; email?: string; password: string } = { password };
      if (email) creds.email = email;
      if (username) creds.username = username;
      // If only email is provided, pass it in both fields so backend can authenticate flexibly
      if (email && !username) creds.username = email;

      const res = await authAPI.login(creds);
      const userProfile = res.user || await authAPI.getProfile();
      setUser(userProfile);
      setProfile(userProfile as Profile);
      router.push("/");
    } catch (error) {
      clearToken();
      setUser(null);
      setProfile(null);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (data: {
    email: string;
    password: string;
    username: string;
    first_name?: string;
    last_name?: string;
    role?: string;
  }) => {
    setLoading(true);
    try {
      const res = await authAPI.register(data);
      if (res.access) {
        setTokens(res.access, res.refresh);
        setUser(res.user);
        setProfile(res.user as Profile);
        router.push("/");
      } else {
        router.push("/login");
      }
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    clearToken();
    setUser(null);
    setProfile(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        login,
        register,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

export type { Profile };
